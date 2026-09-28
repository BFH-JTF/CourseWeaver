# Curriculum Mapping: Content-Overlap, Progression & Constructive Alignment

Diese Fassung ersetzt die frühere, einfachere Version (nur Ähnlichkeits-Schwellenwert).
Sie übernimmt die stärkeren Ideen aus der zweiten Konzeptrunde (drei Leitfragen,
gerichtete Überlappung, I-R-M-Progression, Kalibrierung), ergänzt die fehlende
**Constructive-Alignment-Prüfung** und passt die Architektur an das bestehende
CourseWeaver-Backend an (`domain.ts`, `constraintCatalog.ts`,
`TimetableSolver`-Interface-Muster, `db.ts`).

## 0. Die vier Fragen, die das Tool beantworten soll

Die ursprünglichen drei Fragen waren gut, aber unvollständig — sie decken nur
die *Beziehung zwischen* Learning Cycles ab, nicht die *innere Kohärenz*
eines einzelnen Learning Cycles, die AACSB unter Assurance of Learning
genauso verlangt:

1. Wo werden dieselben Inhalte mehrfach behandelt? *(Content-Overlap)*
2. Handelt es sich um unnötige Redundanz oder sinnvolle Vertiefung?
   *(I-R-M-Progression)*
3. Welche Inhalte bzw. Kompetenzen fehlen im Curriculum? *(Coverage Map)*
4. **Passen innerhalb eines Learning Cycles Lernziel, Lehrmethode und
   Assessment zum beanspruchten Niveau zusammen?** *(Constructive Alignment
   — neu)*

Frage 4 ist keine Ähnlichkeitsanalyse, sondern eine Konsistenzprüfung
*innerhalb* eines LC. Sie braucht dasselbe LLM-Bewertungsmuster wie Frage 1-3,
aber ein anderes Objekt (ein LC allein, kein Paar) und einen anderen Prompt.

## 1. Datenmodell (Stufe 1 — fachliches Domänenmodell)

`LearningCycle` gehört zum selben Domänenmodell wie `Module` aus dem
CP-SAT-Teil (`solver/domain.ts`) — beide beschreiben dasselbe fachliche
Objekt "Modul", nur aus zwei verschiedenen Blickwinkeln (Terminplanung vs.
Inhaltsanalyse). Empfehlung: `Program`, `Instructor` und die Modul-Kernfelder
(`id`, `name`, `program`) in ein gemeinsames `core/domain.ts` auslagern, das
sowohl `solver/domain.ts` als auch das neue `curriculum-mapping/domain.ts`
importieren — sonst laufen zwei leicht unterschiedliche `Module`-Definitionen
im selben Projekt auseinander.

`LearningCycle` bildet exakt die Spalten eurer Excel-Vorlage ab (Learning
Goals, Main Content, Didactics & Tools, Description Assignment, Assignment
Type, Grading Percentage) — nicht nur `topics`/`learningOutcomes` wie im
ursprünglichen Entwurf, sondern auch die Assessment-Felder, die für
Constructive Alignment nötig sind:

```ts
export type IrmLevel = 'I' | 'R' | 'M' // Introduce, Reinforce, Master

export interface LearningCycle {
  id: string
  moduleId: string // Module.id aus core/domain.ts
  structuralElement: string // z.B. "Learning Cycle 3" oder "On-Campus 2"
  learningGoals: string // Spalte "Learning Goals"
  mainContent: string // Spalte "Main Content"
  didactics: string // Spalte "Didactics & Tools"
  assignmentDescription?: string // Spalte "Description Assignment"
  assignmentType?: 'Graded' | 'Pass/Fail' | 'Non-graded'
  gradingPercentage?: number
  level?: IrmLevel // manuell erfasst oder vom LLM vorgeschlagen (siehe 5.2)
  semester?: number
  sourceFile: string
  sourceRow: number
  version: string
}
```

Stabile IDs orientieren sich weiter am [1EdTech-CASE-Standard](https://www.1edtech.org/standards/case)
für verknüpfbare, maschinenlesbare Kompetenzobjekte — das war im
Originalkonzept richtig und bleibt unverändert.

## 2. Vier-Stufen-Pipeline (gleiche Trennung wie beim CP-SAT-Solver)

Damit dieselbe Architektur-Disziplin gilt wie beim Timetable-Solver
(Domain → validierter Input → rohes Ergebnis → erklärtes Ergebnis):

```
LearningCycle[] (Stufe 1, Domain)
        ↓  buildMappingInput()
MappingInput (Stufe 2, validiert: Kandidatenpaare + Alignment-Kandidaten)
        ↓  OverlapAssessor / AlignmentAssessor
RawAssessmentResult (Stufe 3, roh: LLM-JSON pro Paar bzw. pro LC)
        ↓  explainCurriculumMap()
CurriculumMap (Stufe 4, fachlich: Matrix + Coverage Map + offene Prüfpunkte)
```

```ts
// Stufe 2 — validierter Input, analog SolverInput
export interface OverlapCandidate {
  cycleAId: string
  cycleBId: string
  embeddingSimilarity: number
  lexicalSimilarity?: number
}

export interface AlignmentCandidate {
  cycleId: string // jeder LC mit gesetztem `level` und `assignmentType`
}

export interface MappingInput {
  overlapCandidates: OverlapCandidate[] // Stufe-1-Filter: topK pro LC + Schwellenwert
  alignmentCandidates: AlignmentCandidate[] // alle LCs mit vollständigen Assessment-Feldern
}
```

### 2.1 "Kandidaten finden" konkret — was `buildMappingInput()` tatsächlich tut

Das ist der Schritt, der in der App noch inaktiv ist. Ziel: **nicht** jedes
Learning-Cycle-Paar ans LLM schicken — bei 61 LCs (wie im aktuellen Stand)
wären das bereits 1'830 mögliche Paare, bei allen vier Programmen zusammen
ein Vielfaches davon. Stattdessen wird günstig (Embeddings, keine
LLM-Aufrufe) auf eine kleine Menge plausibler Kandidaten vorgefiltert, und
nur die gehen in Stufe 3 (teure LLM-Bewertung).

**Ablauf, Schritt für Schritt:**

1. **Text pro LC zusammensetzen**: `learningGoals + " " + mainContent`
   (optional `didactics` dazu) — ein String pro Learning Cycle, das ist der
   Input fürs Embedding-Modell.
2. **Embedden**: alle LC-Texte eines Programms in einem Batch an den
   `EmbeddingProvider` (Kap. 3) geben, Ergebnis-Vektoren in der
   `learning_cycle_embeddings`-Tabelle cachen (Kap. 6) — nie neu berechnen,
   wenn sich der Text nicht geändert hat.
3. **Ähnlichkeit berechnen**: Cosinus-Ähnlichkeit zwischen allen LC-Paaren
   **innerhalb desselben Programms** (via `pgvector`s `<=>`-Operator, bei
   der aktuellen Grössenordnung reicht auch In-Memory-Berechnung).
4. **Filtern**: pro LC nur die `topK` (z. B. 5) ähnlichsten anderen LCs
   behalten, UND zusätzlich einen Mindest-Schwellenwert verlangen (sonst
   tauchen bei dünn besetzten Themenfeldern auch schwache, irrelevante
   Treffer als "Top 5" auf, nur weil nichts Besseres da ist).
5. **Duplikate entfernen**: Paar (A,B) und (B,A) landen sonst beide in der
   Liste, wenn A für B in Bs Top-5 auftaucht und umgekehrt.
6. **Gleiches Modul meist ausschliessen**: zwei LCs desselben Moduls
   miteinander zu vergleichen ist normalerweise nicht das Ziel (das ist die
   interne Struktur eines Moduls, keine Redundanz zwischen Modulen) — als
   Default rausfiltern, mit der Möglichkeit, das später einzuschalten.

```ts
async function buildMappingInput(cycles: LearningCycle[]): Promise<MappingInput> {
  const texts = cycles.map((c) => `${c.learningGoals} ${c.mainContent}`)
  const vectors = await embeddingProvider.embed(texts)   // gecacht, siehe Kap. 6

  const pairs: OverlapCandidate[] = []
  const seen = new Set<string>()

  cycles.forEach((cycleA, i) => {
    const similarities = cycles
      .map((cycleB, j) => ({ cycleB, j, sim: cosineSimilarity(vectors[i], vectors[j]) }))
      .filter(({ cycleB, sim }) =>
        cycleB.id !== cycleA.id &&
        cycleB.moduleId !== cycleA.moduleId &&   // Schritt 6
        sim >= SIMILARITY_THRESHOLD)              // Schritt 4b
      .sort((a, b) => b.sim - a.sim)
      .slice(0, TOP_K)                            // Schritt 4a

    for (const { cycleB, sim } of similarities) {
      const key = [cycleA.id, cycleB.id].sort().join('::')   // Schritt 5
      if (seen.has(key)) continue
      seen.add(key)
      pairs.push({ cycleAId: cycleA.id, cycleBId: cycleB.id, embeddingSimilarity: sim })
    }
  })

  const alignmentCandidates = cycles
    .filter((c) => c.learningGoals && c.assignmentType)   // vollständig genug für Alignment-Check
    .map((c) => ({ cycleId: c.id }))

  return { overlapCandidates: pairs, alignmentCandidates }
}
```

`TOP_K` und `SIMILARITY_THRESHOLD` sind genau die Werte, die in Kap. 8 der
Doku (Kalibrierung) mit echten Daten justiert werden — bis dahin sind
`TOP_K = 5` und ein Schwellenwert um `0.75` plausible Startwerte (siehe
Schritt D im ursprünglichen Konzept), keine endgültige Entscheidung.

**Ergebnis:** ein Button-Klick auf "Mapping mit KI starten" führt zuerst
diesen Schritt aus (schnell, Sekunden bis wenige Minuten je nach
Programmgrösse), zeigt die gefundene Kandidatenzahl an ("134 Kandidatenpaare
gefunden"), und erst danach beginnt Stufe 3 mit den tatsächlichen
LLM-Aufrufen.

## 3. Solver-Interface-Muster wiederverwendet: austauschbare Bewerter

Genau wie `TimetableSolver` den CP-SAT-Aufruf kapselt, sollten
Embedding-Erzeugung und LLM-Bewertung hinter Interfaces liegen — nicht
`or-tools-wasm` durch `ollama`/`voyage` ersetzt, sondern dasselbe Prinzip
("Anwendungscode kennt nie die konkrete Bibliothek") auf einen anderen
Baustein angewendet:

```ts
export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>
}

export interface OverlapAssessor {
  assess(a: LearningCycle, b: LearningCycle): Promise<OverlapAssessment>
}

export interface AlignmentAssessor {
  assess(cycle: LearningCycle): Promise<AlignmentAssessment>
}
```

`OverlapAssessment` bleibt wie im Originalkonzept (die Typologie
`duplicate | substantial_overlap | partial_overlap | progression |
complementary | same_topic_different_focus | no_meaningful_overlap` mit
gerichteten `overlapA`/`overlapB`-Werten war gut durchdacht — unverändert
übernommen). Neu:

```ts
export interface AlignmentAssessment {
  cycleId: string
  claimedLevel: IrmLevel
  observedCognitiveLevel: 'recall' | 'application' | 'analysis' | 'evaluation' | 'creation'
  assessmentMatchesLevel: boolean
  mismatch?: 'assessment_too_shallow' | 'assessment_too_demanding' | 'no_assessment_present'
  rationale: string
  confidence: number
}
```

Der Prompt bekommt hier **nur einen** Learning Cycle (Lernziel + Didaktik +
Assessment-Beschreibung + Assignment Type), nicht ein Paar — das LLM
beurteilt, ob z. B. "Master"-Niveau mit einem unbenoteten Reading-Quiz
plausibel geprüft wird, oder ob Anspruch und Prüfungsform auseinanderfallen.

## 4. Relationship-Katalog mit stabilen IDs (analog `constraintCatalog.ts`)

Damit Backend-Klassifikation und Frontend-Einfärbung der Matrix dieselbe
Quelle verwenden, statt Farblogik zweimal zu pflegen:

```ts
export const RELATIONSHIP_CATALOG = {
  DUPLICATE: { id: 'DUPLICATE', color: 'red', reviewPriority: 'high',
    description: 'Gleicher Inhalt, gleiches Niveau — vermutlich unnötige Redundanz' },
  SUBSTANTIAL_OVERLAP: { id: 'SUBSTANTIAL_OVERLAP', color: 'amber', reviewPriority: 'high', description: '...' },
  PARTIAL_OVERLAP: { id: 'PARTIAL_OVERLAP', color: 'amber', reviewPriority: 'medium', description: '...' },
  PROGRESSION: { id: 'PROGRESSION', color: 'green', reviewPriority: 'low', description: '...' },
  COMPLEMENTARY: { id: 'COMPLEMENTARY', color: 'green', reviewPriority: 'low', description: '...' },
  SAME_TOPIC_DIFFERENT_FOCUS: { id: 'SAME_TOPIC_DIFFERENT_FOCUS', color: 'grey', reviewPriority: 'low', description: '...' },
  NO_MEANINGFUL_OVERLAP: { id: 'NO_MEANINGFUL_OVERLAP', color: 'grey', reviewPriority: 'none', description: '...' },
} as const

export const ALIGNMENT_CATALOG = {
  ASSESSMENT_TOO_SHALLOW: { id: 'ASSESSMENT_TOO_SHALLOW', color: 'red', reviewPriority: 'high',
    description: 'Beanspruchtes I-R-M-Niveau höher als die Prüfungsform abdeckt' },
  ASSESSMENT_TOO_DEMANDING: { id: 'ASSESSMENT_TOO_DEMANDING', color: 'amber', reviewPriority: 'medium', description: '...' },
  NO_ASSESSMENT_PRESENT: { id: 'NO_ASSESSMENT_PRESENT', color: 'grey', reviewPriority: 'medium',
    description: 'LC ohne erkennbares Assessment — Alignment nicht prüfbar' },
} as const
```

## 5. Zwei Analyse-Dimensionen im Zusammenspiel

|  | Content-Overlap | Constructive Alignment |
|---|---|---|
| Objekt | Paar von Learning Cycles | einzelner Learning Cycle |
| Frage | Behandeln A und B dasselbe? | Passt LO ↔ Didaktik ↔ Assessment zusammen? |
| Nutzt I-R-M für | Progression vs. Duplikation unterscheiden | ob die Prüfungsform zum Niveau passt |
| AACSB-Bezug | Vermeidung unbeabsichtigter Redundanz | Assurance of Learning / dokumentierte Lernentwicklung |

Beide Dimensionen zusammen ergeben erst ein vollständiges Bild: Ein Modulpaar
kann inhaltlich sauber differenziert sein (kein Overlap-Problem) und trotzdem
in einem der beiden LCs ein Alignment-Problem haben (Prüfungsform passt nicht
zum Niveau) — das sind unabhängige Befunde, die getrennt im Review auftauchen
müssen, nicht in einer Kennzahl vermischt werden.

## 6. Persistenz: `db.ts` braucht eine echte pgvector-Erweiterung

Das bestehende generische `entity_store` (JSONB, `table_name`/`id`/`data`)
kann keine Vektor-Ähnlichkeitssuche indizieren. Dafür braucht es eine
dedizierte Tabelle mit `vector`-Spaltentyp und Index — kein JSONB-Workaround:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE learning_cycle_embeddings (
  cycle_id VARCHAR(255) PRIMARY KEY REFERENCES entity_store(id),
  embedding vector(1024) NOT NULL, -- Dimension je nach Modell
  model_id VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lc_embeddings_ivfflat
  ON learning_cycle_embeddings USING ivfflat (embedding vector_cosine_ops);
```

`getAllEntities`/`saveEntity` aus `db.ts` bleiben für die fachlichen Objekte
(`LearningCycle`, `OverlapAssessment`, Review-Status) zuständig — die
Vektorsuche läuft über eine eigene, typisierte Funktion (`findTopKSimilar`),
nicht über die generische Entity-API.

## 7. Nebenläufigkeit: Concurrency-Limiter statt Worker-Thread

Der Worker-Thread-Ansatz aus dem CP-SAT-Teil (Kap. 2 der Architektur-Doku)
löst ein anderes Problem (CPU-lastige, blockierende Berechnung). Embeddings
und LLM-Bewertungen sind **I/O-lastig** (Netzwerk-Calls an Ollama/API) — hier
braucht es eine Begrenzung der *gleichzeitigen* Anfragen, kein separates
V8-Isolate:

```ts
import pLimit from 'p-limit'
const limit = pLimit(5) // max. 5 gleichzeitige LLM-Calls

await Promise.all(
  candidates.map((c) => limit(() => assessor.assess(cycleA, cycleB))),
)
```

Dazu gehören Retry mit Backoff bei Rate-Limits und ein Fortschritts-Log, da
100-200 Kalibrierungspaare (Kap. 9) bzw. hunderte Kandidatenpaare im
Produktivbetrieb einige Minuten laufen können.

## 8. Ansichten (aus dem Originalkonzept übernommen, unverändert gut)

- **Modul-zu-Modul-Matrix** mit Drill-down — primäre Arbeitsansicht
- **Detailansicht eines Modulpaars** (Originaltexte nebeneinander, gemeinsame
  Konzepte, Unterschiede, I/R/M-Niveau, Review-Entscheidung)
- **Progressionsansicht** (I-R-M über Module hinweg) — jetzt ergänzt um einen
  Alignment-Hinweis pro Stufe, falls die Prüfungsform nicht zum Niveau passt
- **Coverage Map** (Kompetenz × Einführung/Verstärkung/Vertiefung/Assessment)
- **Themencluster** und **Netzwerkansicht** — explizit als Sekundäransichten,
  nicht MVP (siehe unten)

## 9. Review-Workflow & Kalibrierung

Unverändert aus dem Originalkonzept übernommen — beides war bereits gut
durchdacht:

- Status-Lebenszyklus `AI suggested → Pending review → Confirmed/Rejected →
  Published`, versioniert
- Kalibrierung vor Produktivbetrieb: 100-200 Paare, zwei Fachpersonen
  unabhängig klassifizieren, Precision/Recall je Beziehungstyp messen,
  Embedding-Schwellenwert und Prompt danach justieren
- Reaktionstabelle (hohe/mittlere/niedrige Sicherheit, Widerspruch
  Embedding↔LLM) bleibt wie vorgeschlagen

Ergänzung: Die Alignment-Bewertung (Kap. 5) braucht eine **eigene**
Kalibrierungsrunde mit eigenem Paar-/Einzel-Sample — die Precision/Recall
für "ist das Overlap echt?" und "passt das Assessment zum Niveau?" sind
unabhängige Grössen und dürfen nicht in einer gemeinsamen Kennzahl vermischt
werden.

## 10. MVP-Scope (angepasst)

Der ursprüngliche MVP-Vorschlag liess Constructive Alignment für später —
das würde die zentrale AACSB-Anforderung aus dem MVP ausklammern. Empfehlung:

1. Learning Cycles aus Excel importieren (Spalten wie in Kap. 1)
2. Ähnliche Paare automatisch finden (Embedding + topK)
3. LLM-Overlap-Bewertung strukturiert erzeugen
4. **LLM-Alignment-Bewertung pro Learning Cycle** (neu — gehört in den MVP,
   nicht in "danach")
5. Modulmatrix mit Drill-down anzeigen (inkl. Alignment-Hinweisen)
6. Menschliche Entscheidungen erfassen und exportieren

Themencluster, Netzwerkvisualisierung und automatische
Verbesserungsvorschläge bleiben wie vorgeschlagen für später.

## 11. Checkliste

- [ ] `Program`/`Instructor`/Modul-Kernfelder in gemeinsames `core/domain.ts`
      auslagern, von `solver/domain.ts` und neuem
      `curriculum-mapping/domain.ts` referenzieren
- [ ] `LearningCycle` gemäss Kap. 1 anlegen, 1:1 auf Excel-Spalten gemappt
- [ ] `buildMappingInput()` (Stufe 2): Embedding-Kandidaten (topK + Schwelle)
      und Alignment-Kandidaten (LCs mit vollständigen Assessment-Feldern)
      getrennt aufbauen
- [ ] `EmbeddingProvider`, `OverlapAssessor`, `AlignmentAssessor` als
      Interfaces anlegen, austauschbare Implementierung dahinter (Ollama
      lokal vs. Cloud-API)
- [ ] `RELATIONSHIP_CATALOG` und `ALIGNMENT_CATALOG` mit stabilen IDs, von
      Backend-Klassifikation und Frontend-Matrix gemeinsam genutzt
- [ ] `pgvector`-Erweiterung + `learning_cycle_embeddings`-Tabelle in
      `db.ts` ergänzen, getrennt vom generischen `entity_store`
- [ ] Concurrency-Limiter (`p-limit` o. ä.) für LLM-/Embedding-Calls statt
      Worker-Thread-Isolation
- [ ] Kalibrierungsrunde getrennt für Overlap- und Alignment-Bewertung
      durchführen, Precision/Recall je Beziehungstyp separat messen
- [ ] Review-Workflow mit Audit Trail wie im Originalkonzept umsetzen
- [ ] MVP gemäss Kap. 10 (inkl. Alignment-Bewertung) vor Sekundäransichten
      (Cluster, Netzwerk) umsetzen

## 12. Review der ersten Import-Implementierung (`curriculum-page-files.zip`)

Das ZIP enthält bislang nur Stufe 1 (Excel-Import) — die eigentliche
Mapping-Matrix (Kap. 8) existiert noch nicht, das ist für diesen Stand
erwartbar. Vier Befunde sollten aber vor dem Weiterbau behoben werden, weil
sie die spätere Mapping-Logik strukturell blockieren würden.

### 12.1 Import verarbeitet nur eine Datei, nicht mehrere

**Datei:** `components/CsvImportDialog.vue`, Zeile 573 und 581

```ts
const file = input.files?.[0]              // Dateiauswahl
const file = event.dataTransfer?.files?.[0] // Drag & Drop
```

Beide Eingabewege nehmen explizit nur das erste Element aus der Dateiliste —
auch bei Mehrfachauswahl oder Drop mehrerer Dateien wird der Rest verworfen,
ohne Hinweis an die Person. Das widerspricht direkt der Anforderung: Ihr
wollt, dass **mehrere Excel-Dateien pro Programm** (eine je Semester) der
Standardfall sind, nicht eine Ausnahme, die man dreimal manuell wiederholt.

### 12.2 Semester ist im Datenmodell nirgends abgebildet

**Dateien:** `stores/curriculum.ts` (Interfaces `Module`, `Lesson`),
`utils/csvSchemas.ts` (`learning_cycles`-Schema, Zeile 693-775)

Weder `CurriculumModule` (aus `@/types/curriculumMapping`, für den
`learning_cycles`-Import) noch `Module` im Store haben ein Semester-Feld.
`Semester` existiert zwar als eigene Entität (`identifier`, `startDate`,
`endDate`), aber nichts verknüpft ein Modul mit ihr. Genau das braucht ihr
aber für "Mapping über sämtliche Module und Semester" — ohne dieses Feld
lässt sich später nicht einmal die Progressionsansicht (Kap. 8, I-R-M über
Module hinweg) korrekt bauen, weil die zeitliche Reihenfolge fehlt.

### 12.3 Zwei inkompatible Datenformen landen in derselben Tabelle

**Datei:** `composables/useCsvImport.ts`, Zeile 10-18

```ts
const entityTableMap: Record<ImportType, string> = {
  modules: EntityTables.MODULE,          // 'modules'
  learning_cycles: EntityTables.MODULE,  // ebenfalls 'modules' !
  // ...
}
```

Der `modules`-Importtyp erzeugt Objekte der Form `{ name, code,
creditPoints, contactHours, ... }` (aus `stores/curriculum.ts`), der
`learning_cycles`-Importtyp erzeugt `{ id, name, program, learningCycles:
[...] }` (aus `types/curriculumMapping`) — beide landen aber in derselben
Postgres-Tabelle `modules`. Die IDs werden zudem unterschiedlich erzeugt
(`cw_${Date.now()}_...` vs. deterministisch `mod-${program}-${name}`), es
gibt also weder ein gemeinsames Schema noch eine verlässliche Trennung. Das
ist eine tickende Zeitbombe, sobald beide Importtypen im selben Projekt
benutzt werden.

**Fix:** `learning_cycles` braucht eine eigene Tabelle, z. B.
`EntityTables.CURRICULUM_MODULE` (`'curriculum_modules'`) — analog zur
Empfehlung aus Kap. 1 dieser Doku, `LearningCycle` architektonisch vom
scheduling-bezogenen `Module` zu trennen, aber über ein gemeinsames
`core/domain.ts` zu verbinden statt über eine geteilte Tabelle.

### 12.4 `program` ist ein Freitext-String, kein Verweis auf `StudyProgram`

**Datei:** `utils/csvSchemas.ts`, Zeile 744-745, 748

```ts
const program = String(obj.program || '')
// ...
const key = `${program}::${name}`
```

`program` wird direkt aus der Excel-Zelle als String übernommen und nie
gegen die `study_programs`-Tabelle aufgelöst. Tippfehler oder
Schreibvarianten ("MBA" vs. "M.B.A." vs. "mba") erzeugen stillschweigend
unterschiedliche Programme, die beim späteren Mapping nicht mehr
zusammengeführt werden können.

## 13. Umbauvorschlag: Mehrdatei-Import als Standardfall

Statt "ein Importtyp → eine Datei → Spalten zuordnen → speichern" sollte der
Ablauf für `learning_cycles` speziell so aussehen:

```
1. Programm auswählen (StudyProgram.id, nicht Freitext)
        ↓
2. Mehrere Excel-Dateien auswählen/droppen (eine pro Semester)
        ↓  parseModuleConceptWorkbook() pro Datei
3. Vorschau gruppiert nach Semester + Modul (nicht nach Datei)
        ↓  Semester pro Datei bestätigen/korrigieren (z. B. aus
           Dateiname vorgeschlagen, wie bei DBA_Module_Concept_Semester2_FS2027.xlsx)
        ↓  alle Dateien in einem Schritt speichern
4. "Mapping berechnen" — läuft über ALLE gespeicherten
   CurriculumModule-Einträge des gewählten Programms, nicht nur über
   die gerade importierten
```

```ts
// Ersetzt den bisherigen Single-File-Handler in CsvImportDialog.vue
function handleFilesSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])   // statt files?.[0]
  files.forEach(readUploadedFile)
}

// CurriculumModule bekommt ein Pflichtfeld, keinen Freitext-Verweis
interface CurriculumModule {
  id: string
  name: string
  studyProgramId: string   // FK auf StudyProgram.id, aufgelöst vor dem Speichern
  semester: number         // aus Dateiname vorgeschlagen, von der Person bestätigt
  learningCycles: LearningCycle[]
}
```

Schritt 4 ist der eigentliche Kern eurer Anforderung: "Mapping berechnen"
ist kein Nebeneffekt eines einzelnen Imports, sondern eine eigene Aktion,
die `buildMappingInput()` (Kap. 2) über den vollständigen Bestand eines
Programms aufruft — importierte Dateien reichern nur den Bestand an, sie
lösen die Analyse nicht automatisch pro Datei aus.

## 14. Offene Frage

`utils/excelParser.ts` (mit `parseModuleConceptWorkbook`) war nicht im ZIP
enthalten. Bevor ich beurteilen kann, ob der Parser bereits korrekt mit
Semester-Metadaten aus dem Dateinamen oder der Sheet-Struktur umgeht, müsste
ich diese Datei sehen.

## 15. Kompetenzrahmen als austauschbare, mehrfach vorhaltbare Entität

Das BFH-Kompetenzframework (4 Domänen × 4 Dimensionen = 16 Kompetenzen)
soll als **Daten**, nicht im Code hinterlegt werden — und zwar so, dass
mehrere Kompetenz-Sets nebeneinander existieren können ("andere User
andere Kompetenzen prüfen"), nicht als eine einzige globale Liste.

### 15.1 Lücke im bestehenden `competencies`-Importtyp

**Datei:** `utils/csvSchemas.ts`, Zeile 553-614 (Import-Review, Kap. 12)

Der vorhandene `Competency`-Typ (`name`, `category`, `topic`, `description`,
`level`) passt inhaltlich fast genau auf das Framework — `category` kann die
Domäne (Professional/Entrepreneurial/...) aufnehmen, `topic` die Dimension
(Disciplinary/Methodological/...). Es fehlt aber ein **Framework-Container**:
Ohne ihn landen die Kompetenzen mehrerer Personen in derselben Tabelle
(`EntityTables.COMPETENCY`) und lassen sich nicht mehr auseinanderhalten —
dieselbe Art von Problem wie die Tabellen-Kollision in Kap. 12.3, nur hier
von Anfang an vermeidbar.

**Alt** (aus der Verwendung in `utils/csvSchemas.ts` erschlossen, Datei
`types/competency.ts` war nicht im ZIP enthalten):
```ts
export interface Competency {
  name: string
  category?: string
  topic?: string
  description?: string
  level?: SkillLevel
}
```

**Neu:**
```ts
export interface CompetencyFramework {
  id: string
  name: string            // z. B. "BFH Master-Kompetenzrahmen 2026"
  ownerId?: string        // sobald Auth existiert (siehe Solver-Review, Punkt 5); bis dahin optional
  isShared: boolean        // sichtbar für alle vs. nur für ownerId
  createdAt: string
}

export interface Competency {
  id: string
  frameworkId: string      // NEU — Pflichtfeld, verhindert Vermischung mehrerer Sets
  name: string
  category?: string        // Domäne: Professional / Entrepreneurial / Sustainable / Digital
  topic?: string            // Dimension: Disciplinary / Methodological / Personal / Social
  description?: string
  level?: SkillLevel
  order?: number            // Reihenfolge innerhalb des Frameworks für stabile Darstellung
}
```

`EntityTables` (in `composables/usePostgres.ts`) braucht dafür einen neuen
Eintrag `COMPETENCY_FRAMEWORK: 'competency_frameworks'`, analog zu den
bestehenden Tabellen.

### 15.2 Wie das Coverage-Map-Konzept (Kap. 8) davon profitiert

Die dort skizzierte Coverage Map (Kompetenz × Einführung/Verstärkung/
Vertiefung/Assessment) bekommt jetzt einen zweiten Parameter: nicht nur
"welches Programm", sondern auch "welches Framework". Zwei Personen können
dieselben Module gegen unterschiedliche Kompetenzraster prüfen, ohne dass
sich die Ergebnisse überschreiben — genau die Anforderung aus deiner
Nachricht.

### 15.3 Die 16 Kompetenzen als importierbare Datei

Die Kompetenzen liegen als CSV vor, passend zum bestehenden
`competencies`-Importtyp (Spalten `name`, `category`, `topic`,
`description`) plus der neuen Spalte `framework_name`, damit die
Import-Logik daraus automatisch ein `CompetencyFramework` anlegt bzw.
wiederverwendet, statt die Kompetenzen lose in die Tabelle zu schreiben.
