# Curriculum-Mapping-Übersicht: Umsetzung in Vue

Beschreibt den [Entwurf](https://claude.ai/artifact/4HGKCz9XGwZcu3Sbiujem1),
der den Screenshot-Zustand (flacher Text-Dump) ersetzt.

## 1. Die eigentliche Ursache liegt nicht in der Anzeige, sondern im Import

Bevor an der Vue-Komponente etwas geändert wird: Der Screenshot zeigt, dass
`Explanation:`, `Structural Elements` und jede Learning-Cycle-Zeile als
**eigene, unstrukturierte Zeile** gespeichert wurden. Das heisst, der Import
hat das Excel-Sheet zeilenweise als Text gelesen, nicht gemäss dem
Modul-Konzept-Format geparst (Titel + Beschreibung + Erklärungszeile +
Header + 10 Struktur-Zeilen, siehe `sample-data.js`/die generierten
DBA-Excel-Dateien). Egal wie gut die Anzeige-Komponente wird — solange
`learning_cycles` diesen flachen Text liefert statt echter
`LearningCycle[]`-Objekte (Kap. 1, `curriculum-mapping-llm-similarity.md),
bleibt es unbrauchbar. Zuerst prüfen: Wird `parseModuleConceptWorkbook`
für diesen Import-Typ überhaupt aufgerufen, oder landet die Datei im
generischen CSV-Zeilen-Parser?

## 2. Komponenten für die neue Übersicht

```
components/curriculum/
├── CurriculumMappingPage.vue   ← Rahmen: Header, Pipeline-Stepper, Layout
├── PipelineStepper.vue         ← die 4 Schritte oben (Import → Review)
├── SemesterSection.vue         ← aufklappbarer Block pro Semester
├── ModuleCard.vue              ← aufklappbare Modul-Zeile mit ECTS-Badge
└── LearningCycleRow.vue        ← eine LC-Zeile: KW-Badge, Titel, Vorschau
```

Datenquelle: `LearningCycle[]` aus Kap. 1 der Mapping-Doku, gruppiert nach
`studyProgramId` → `semester` → `moduleId` — dieselbe Struktur, die auch
für das Mapping selbst gebraucht wird (Kap. 2, `buildMappingInput()`).
Kein separates Anzeige-Datenmodell nötig.

## 3. Was der "Mapping mit KI starten"-Button tatsächlich auslöst

Das ist der eigentlich neue Teil deiner Anfrage: nicht nur besser anzeigen,
sondern die Daten an ein LLM übergeben. Der Button löst genau die Pipeline
aus, die in `curriculum-mapping-llm-similarity.md` (Kap. 2–3) beschrieben
ist — der Stepper im Entwurf zeigt sie als vier Schritte:

```ts
async function startMapping() {
  const cycles = await fetchAllLearningCycles(studyProgramId.value)   // Stufe 1
  const input = buildMappingInput(cycles)                              // Stufe 2: Embeddings + topK
  const raw = await Promise.all([
    overlapAssessor.assessAll(input.overlapCandidates),                // Stufe 3a: LLM pro Paar
    alignmentAssessor.assessAll(input.alignmentCandidates),             // Stufe 3b: LLM pro LC
  ])
  const map = explainCurriculumMap(raw)                                  // Stufe 4
  router.push({ name: 'curriculum-map-review', params: { runId: map.id } })
}
```

Wichtig: Das läuft nicht synchron im Klick-Handler — bei 168 Learning
Cycles sind das potenziell hunderte LLM-Aufrufe (mit dem
Concurrency-Limiter aus Kap. 7, ein paar Minuten). Der Button sollte sofort
zu einer Fortschrittsansicht wechseln (der Stepper aus dem Entwurf eignet
sich dafür: Schritt 3 bekommt einen Lade-Zustand, keinen fixen State), nicht
auf der Übersicht warten.

## 4. Zustand für Auf-/Zuklappen

```ts
const expandedSemesters = ref<Record<string, boolean>>({ s2: true })
const expandedModules = ref<Record<string, boolean>>({})

function toggleSemester(id: string) {
  expandedSemesters.value[id] = !expandedSemesters.value[id]
}
```

Gleiches Akkordeon-Muster wie in `ImportFileCard.vue` (voriger Entwurf) —
bewusst wiederverwendet, damit sich Auf-/Zuklappen in der ganzen App gleich
anfühlt, statt für jede Liste ein eigenes Verhalten zu erfinden.

## 5. Design-Tokens

Dieselben wie bei den beiden vorherigen Entwürfen (Fraunces/IBM Plex Sans,
`#2B6E63` als Akzent). Neu: **Coral (`#C6603F`) für den "Mapping mit
KI starten"-Button und den Fortschritts-Indikator** — dieselbe Farbe, die
im Ablaufschema von vor zwei Nachrichten für "LLM-Einsatz" stand. Diese
Farbzuordnung sollte in der ganzen App konsequent für LLM-Aktionen gelten,
nicht nur hier — sonst verliert das Signal seinen Wert.
