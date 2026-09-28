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
