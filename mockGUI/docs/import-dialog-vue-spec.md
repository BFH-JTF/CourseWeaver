# Import-Dialog: Umsetzung in Vue

Beschreibt den [überarbeiteten Entwurf](https://claude.ai/artifact/ME5YB78hB8AApSetuFsgH4)
für einen Vue-Nachbau. Löst drei konkrete Probleme aus dem Screenshot:

1. Es liess sich nur eine Datei auf einmal hochladen
2. "Mandatory Variables" war unverständlicher Fachbegriff ohne Erklärung
3. Der eigentliche Auslöser des Problems im Screenshot: Der globale
   "Import Type"-Dropdown stand auf "Study Programs", obwohl die Datei
   (`DBA_Module_Concept_Semester1_HS2026.xlsx`) ein Modul-Konzept ist — die
   alte UI bot keine Möglichkeit, diesen Fehlgriff zu bemerken

## 1. Die wichtigste Design-Entscheidung: kein globaler Import-Type-Dropdown mehr

Im alten Design galt EIN Importtyp für die ganze Datei, von der Person
manuell gewählt. Im neuen Entwurf hat **jede Datei ihren eigenen,
automatisch erkannten Typ** — der globale Dropdown fällt komplett weg. Das
ist keine kosmetische Änderung, sondern behebt die Ursache: Bei mehreren
Dateien unterschiedlichen Typs (z. B. ein Modul-Konzept und eine
Studiengangsliste im selben Import) hätte ein einzelner globaler Dropdown
ohnehin nie gepasst.

## 2. Komponenten-Aufteilung

```
components/import/
├── ImportDialog.vue          ← Rahmen: Header, Drop-Zone, Footer
├── ImportDropZone.vue        ← Drag&Drop-Fläche, akzeptiert mehrere Dateien
├── ImportFileCard.vue        ← eine Zeile in der Dateiliste (Kopf + Klapp-Inhalt)
├── TypeMismatchWarning.vue   ← der gelbe Warnhinweis samt "Wechseln"-Button
└── MandatoryFieldsList.vue   ← die aufgeklappten Pflichtfelder
```

## 3. Typ-Erkennung — der eigentlich neue Teil

Das ist die Logik, die vorher fehlte. Für jede hochgeladene Datei:

```ts
interface ImportTypeDef {
  id: string
  label: string
  // Spaltennamen, die typisch für diesen Dateityp sind
  signatureColumns: string[]
  mandatoryFields: Array<{ name: string; why: string; resolve: (sheet: ParsedSheet) => string | null }>
}

function detectImportType(file: ParsedFile, types: ImportTypeDef[]): ImportTypeDef {
  const columns = file.columns.map((c) => c.toLowerCase())
  // je Typ zählen, wie viele seiner Signatur-Spalten in der Datei vorkommen
  const scored = types.map((t) => ({
    type: t,
    score: t.signatureColumns.filter((sig) => columns.includes(sig.toLowerCase())).length,
  }))
  scored.sort((a, b) => b.score - a.score)
  return scored[0].type
}
```

Für "Module & Learning Cycles" wären `signatureColumns` z. B. `["learning
goals", "main content", "didactics & tools", "assignment type"]` — genau
die Spalten, die euer `parseModuleConceptWorkbook` (aus dem vorherigen
Import-Review, Kap. 14 — die Datei war damals nicht im ZIP enthalten, lohnt
sich aber jetzt anzusehen) vermutlich schon kennt. Am saubersten: die
Signatur-Spalten dort direkt neben dem Parser pflegen, nicht an einer
zweiten Stelle duplizieren.

**Override bleibt möglich**: Die Erkennung ist ein Vorschlag, keine feste
Entscheidung — die Person kann den Typ pro Datei manuell ändern (im Entwurf
der Zustand, in dem Datei 2 startet: "Study Programs" statt der erkannten
Alternative). Der Warnhinweis erscheint automatisch, wenn `detectImportType()`
zu einem anderen Ergebnis kommt als der aktuell gewählte Typ:

```ts
const mismatched = computed(() =>
  file.value.chosenTypeId !== detectImportType(file.value, allTypes).id
)
```

## 4. Zustand

```ts
// ImportDialog.vue
const uploadedFiles = ref<UploadedFile[]>([])   // je: { id, name, size, columns, rows }
const chosenTypeId = ref<Record<string, string>>({})   // Datei-ID → gewählter Typ (Override)
const expandedFileId = ref<string | null>(null)         // welche Karte ist aufgeklappt

function fileType(file: UploadedFile) {
  const override = chosenTypeId.value[file.id]
  return override ? typesById[override] : detectImportType(file, allTypes)
}
```

`expandedFileId` ist bewusst ein einzelner Wert, kein Set — im Entwurf ist
immer höchstens eine Datei gleichzeitig aufgeklappt (Akkordeon-Verhalten),
das hält die Liste bei vielen Dateien übersichtlich.

## 5. Pflichtfelder verständlich machen

Der alte Screenshot zeigte nur "Program Name *" mit rotem Ausrufezeichen —
ohne zu sagen, *wofür* das gebraucht wird. Jedes Pflichtfeld bekommt jetzt
drei Teile statt einem:

```ts
interface MandatoryField {
  name: string                                    // "Modulname"
  why: string                                      // "wird als eindeutige Kennung verwendet"
  resolve: (file: UploadedFile) => string | null   // woher der Wert automatisch kommt
}
```

`resolve()` versucht den Wert automatisch aus der Datei abzuleiten (Spalte,
Sheet-Titel, Dateiname — wie in `parseModuleConceptWorkbook` vermutlich
schon vorhanden), damit möglichst nichts von Hand nachgetragen werden muss.
Nur wenn `resolve()` `null` liefert, erscheint überhaupt ein
Auswahl-Dropdown zum manuellen Zuordnen — im Normalfall (Datei 1 im
Entwurf) ist alles schon grün abgehakt, ohne dass die Person etwas tun
muss.

## 6. Design-Tokens

Dieselben Werte wie bei der Constraint-Erfassungsseite (Fraunces/IBM Plex
Sans, `#2B6E63` als Akzent, `#E3DFD3` als Rahmenfarbe usw.) — nicht noch
einmal neu erfunden, siehe `constraint-ui-vue-spec.md`, Abschnitt 6. Neu
dazugekommen ist nur die Warnfarbe für Typ-Konflikte:

| Element | Wert |
|---|---|
| Warnhinweis Hintergrund | `#FDF3E4` |
| Warnhinweis Rahmen | `#F0DDB8` |
| Warnhinweis Text | `#A6790F` / `#7A5A16` |

## 7. Backend-Seite nicht vergessen

Diese UI setzt voraus, dass der Import-Endpunkt mehrere Dateien in einem
Aufwasch entgegennimmt und jede mit ihrem eigenen (ggf. übersteuerten) Typ
verarbeitet — das ist genau der "Mehrdatei-Import als Standardfall" aus
`curriculum-mapping-llm-similarity.md`, Kap. 13. Die dortigen Punkte gelten
unverändert: `learning_cycles`-Importe brauchen eine eigene Tabelle statt
der geteilten `modules`-Tabelle (Kap. 12.3), und Semester muss als
strukturiertes Feld ankommen, nicht nur als Dateiname-Konvention.
