# CP-SAT-Integration für CourseWeaver: Entscheidung & Vorgehen

## 1. Entscheidung in einem Satz

CP-SAT läuft **serverseitig in Node.js** (nicht im Browser), gekapselt hinter
einem eigenen Interface – Browser-Solving ist eine mögliche spätere
Zusatzfunktion, keine Voraussetzung.

## 2. Warum Node statt Browser

| | Node.js (Server) | Browser |
|---|---|---|
| Hardware | kontrolliert, einheitlich | stark unterschiedlich (Gerät des Nutzers) |
| Header/Setup | keine besonderen Anforderungen | braucht `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp`, sonst scheitern WASM-Threads |
| Daten | Planungsdaten bleiben zentral | verlassen ggf. das Endgerät |
| Ergebnisse | zentral speicher-/versionierbar | pro Gerät verstreut |
| Jobs | überwachbar, abbrechbar | schwerer kontrollierbar |
| Ausnahme | – | sinnvoll für Offline-Modus, lokale Was-wäre-wenn-Simulationen, keine Serverkosten |

**Wichtig:** Solver-Läufe nicht im normalen Request-Handler ausführen, sondern
in einem **eigenen Worker Thread / Prozess** – sonst blockiert eine
Optimierung den Event Loop, und ein Speicherproblem reisst die ganze API mit.

## 3. Architektur: drei Trennungen, die eingehalten werden müssen

### 3.1 Solver hinter Interface kapseln

`or-tools-wasm` nicht direkt im Anwendungscode importieren, sondern über ein
Interface ansprechen. Das hält eine spätere zweite Implementierung (z. B.
Aufruf eines nativen Python-Service) offen, ohne den Rest der App anzufassen.

```ts
export interface TimetableSolver {
  solve(problem: TimetableProblem, options: SolveOptions): Promise<TimetableSolution>;
}

export class OrToolsWasmTimetableSolver implements TimetableSolver {
  // CP-SAT-Modellierung (siehe schedule-model.js)
}
```

### 3.2 Domänenmodell und CP-SAT-Modell trennen

```
Fachliches Stundenplanmodell
        ↓
validierter SolverInput
        ↓
CP-SAT Model Builder
        ↓
CP-SAT-Ergebnis
        ↓
fachliches Ergebnis + Erklärungen
```

Frontend-Daten dürfen **nicht** direkt zu CpModel-Variablen werden – sonst
lässt sich die mathematische Formulierung nie mehr ändern, ohne die ganze
App umzubauen. Damit das keine reine Absichtserklärung bleibt, hier jede
Stufe als konkreter Typ:

**Stufe 1 — Fachliches Domänenmodell** (das, was Menschen im Kopf haben;
entspricht `sample-data.js`, nur jetzt als Typen statt loser Objekte):

```ts
interface Program { id: string; name: string; }
interface Instructor { id: string; name: string; }
interface Room { id: string; name: string; capacity: number; }

interface OnCampusDay {
  id: string;
  date: string;          // ISO-Datum
  week: number;          // Kalenderwoche
  weekday: 'Donnerstag' | 'Freitag' | 'Samstag';
  phase: 'main' | 'final';
}

type SlotType = 'vormittag' | 'nachmittag' | 'abend';

interface Restriction {
  id: string;                       // stabile ID, siehe Constraint-Katalog (3.3)
  category: 'hard' | 'soft';
  weight?: number;                  // nur bei 'soft'
  params?: Record<string, unknown>; // z. B. { dates: ['2026-11-14'] }
}

interface Module {
  id: string;
  name: string;
  program: string;        // Program.id
  ects: 3 | 6;
  expectedStudents: number;
  instructors: string[];  // Instructor.id[]
  restrictions: Restriction[];
}
```

**Stufe 2 — validierter `SolverInput`** (fachlich neutral, nur noch das, was
der Solver braucht — hier gehört die bisher in `schedule-model.js` direkt
im Code verstreute Filterlogik hin, z. B. `isDayAllowed`/`isRoomAllowed`):

```ts
interface SolverSession {
  id: string;
  moduleId: string;
  slotTypes: SlotType[];      // ['vormittag'] oder ['vormittag','nachmittag'] = ganzer Tag
  expectedStudents: number;
  instructorIds: string[];
  allowedDayIds: string[];    // bereits gegen harte Restriktionen gefiltert
  allowedRoomIds: string[];   // bereits gegen Kapazität gefiltert
  softPenalties: Array<{ dayId: string; constraintId: string; weight: number }>;
}

interface SolverInput {
  sessions: SolverSession[];
  days: OnCampusDay[];
  rooms: Room[];
  weeklyBalance: { weeks: number[]; lowerPerWeek: number; upperPerWeek: number };
}

// Diese Funktion trägt die ganze fachliche Interpretation der Restriktionen.
// Der CP-SAT Model Builder (Stufe 3) kennt danach keine Restriction-Objekte mehr,
// nur noch Listen erlaubter IDs und vorgerechnete Strafkosten.
declare function buildSolverInput(
  modules: Module[],
  days: OnCampusDay[],
  rooms: Room[],
): SolverInput;
```

**Stufe 3 — CP-SAT-Ergebnis** (roh, wie es aus `schedule-model.js` kommt):

```ts
interface RawSolverResult {
  status: 'OPTIMAL' | 'FEASIBLE' | 'INFEASIBLE' | 'UNKNOWN';
  objectiveValue: number;
  assignments: Array<{ sessionId: string; dayId: string; roomId: string }>;
}
```

**Stufe 4 — fachliches Ergebnis + Erklärungen** (das, was UI/Bericht zeigt):

```ts
interface ScheduledSession {
  moduleId: string;
  moduleName: string;
  day: OnCampusDay;
  room: Room;
  slotTypes: SlotType[];
}

interface RuleEvaluation {
  constraintId: string;      // dieselbe ID wie im Constraint-Katalog (3.3)
  category: 'hard' | 'soft';
  satisfied: boolean;
  cost: number;
  affectedSessionIds: string[];
}

interface TimetableSolution {
  status: RawSolverResult['status'];
  objectiveValue: number;
  schedule: ScheduledSession[];
  explanations: RuleEvaluation[];
}
```

Jede Stufe bekommt so eine eigene, testbare Funktion
(`buildSolverInput`, `OrToolsWasmTimetableSolver.solve`, `explainSolution`)
statt einer einzigen grossen Datei, die Restriktionsauswertung,
Variablenbau und Ausgabe vermischt — genau das war in `schedule-model.js`
bisher der Fall und sollte beim Ausbau als Erstes aufgelöst werden.


### 3.3 Constraint-Katalog mit stabilen IDs

Jede Regel bekommt eine ID, Kategorie und Gewicht:

```ts
type ConstraintDefinition = {
  id: string;
  category: "hard" | "soft";
  weight: number;
  enabled: boolean;
};

const constraints = {
  NO_TEACHER_OVERLAP: { category: "hard", weight: 1 },
  AVOID_FRIDAY_AFTERNOON: { category: "soft", weight: 20 },
  MINIMIZE_STUDENT_GAPS: { category: "soft", weight: 5 },
};
```

CP-SAT liefert keine automatische fachliche Erklärung wie andere
Solver-Frameworks (z. B. Timefold). **Nach dem Lösen jede Regel nochmals
gegen den fertigen Stundenplan auswerten** und einen verständlichen Bericht
erzeugen.

## 4. Risiken der Bibliothek `or-tools-wasm`

Der Solver selbst ist echter OR-Tools-Code. Das Risiko liegt in der
**Integrationsschicht**:

- ein einzelner Hauptmaintainer, kleine Community
- keine offizielle Unterstützung durch Google
- mögliche Verzögerung bei neuen OR-Tools-Versionen
- WASM-spezifische Fehler; einzelne Funktionen/Parameter können sich anders
  verhalten als im nativen Build (aktuell z. B. ein offener Fehler bei
  benannten Subsolver-Filtern)
- Build-/Bundler-Kompatibilität kann sich ändern

Die Stern-Zahl auf GitHub ist kein Qualitätsmerkmal. Relevanter sind:
automatisierte Tests über mehrere Laufzeiten/Bundler, nachvollziehbare
Releases, zeitnahe Synchronisation mit OR-Tools, dokumentierte
API-Abdeckung, reproduzierbare Benchmarks, Reaktionszeit auf Issues. Die
vorhandene Fixture-Matrix über Browser, Node, Bun und Deno ist ein gutes
Zeichen.

## 5. Massnahmen zur Risikominderung — Checkliste

- [ ] **Solver-Interface** wie unter 3.1 anlegen, bevor mehr Code entsteht
- [ ] **Domänenmodell/SolverInput/CP-SAT-Modell** strikt trennen (3.2)
- [ ] **Constraint-Katalog** mit ID + Gewicht führen (3.3), keine Regel „hart
      codiert" im Modell verstecken
- [ ] **Referenztest gegen nativen Solver**: identisches Modell einmal in
      `or-tools-wasm`, einmal mit offiziellem OR-Tools in Python lösen –
      gleicher Input, gleiche Constraints, Vergleich von Status, Bound und
      Objective-Wert (die konkreten Pläne müssen nicht identisch sein,
      mehrere Lösungen können gleich gut sein)
- [ ] **Abhängigkeit fixieren**: konkrete Paketversion festschreiben,
      WASM-Build als eigenes Artefakt sichern, Updates erst nach
      Regressionstests übernehmen, Fork-Option im Hinterkopf behalten
- [ ] **Benchmark-Set** mit repräsentativen Stundenplaninstanzen anlegen und
      behalten (für jeden Vergleichslauf wiederverwendbar)

## 6. Proof-of-Concept — Akzeptanzkriterien

Bevor CP-SAT/`or-tools-wasm` verbindlich für CourseWeaver festgelegt wird,
soll ein Node-basierter PoC mit diesen Grössenordnungen laufen:

| Grösse | Zielwert |
|---|---|
| Veranstaltungseinheiten | 300–1'000 |
| Zeitslots | 30–100 |
| Räume | 20–100 |
| Dozenten-/Kohortenüberschneidungen | ja, modelliert |
| Raumkapazität & Ausstattung | ja, modelliert |
| Sperrzeiten | ja, modelliert |
| gewichtete Präferenzen | 3–5 |
| Zeitlimit | 30–120 Sekunden |

**Kriterium:** Besteht das Modell diesen Test zuverlässig, gibt es keinen
zwingenden Grund, zusätzlich Java/Kotlin oder Python einzuführen.

## 7. CP-SAT vs. Timefold — wann was

| Priorität | Bessere Wahl |
|---|---|
| Alles in TypeScript entwickeln | CP-SAT via `or-tools-wasm` |
| Fachlich besonders lesbare Constraints | Timefold |
| Automatische Constraint-/Score-Analyse | Timefold |
| Optimalitätsgrenzen & Unlösbarkeitsnachweis | CP-SAT |
| Minimale Zahl verschiedener Technologien | `or-tools-wasm` |
| Offiziell gepflegte Sprachintegration | Timefold (Java/Kotlin) |
| Kein zusätzlicher Java-/Python-Service | `or-tools-wasm` |
| Laufende Umplanung mit wenigen Änderungen | Timefold etwas natürlicher, CP-SAT ebenfalls modellierbar |

**Für CourseWeaver spricht CP-SAT/`or-tools-wasm`, wenn:**
1. konsequent TypeScript verwendet werden soll,
2. die Bereitschaft besteht, Constraints mathematisch/strukturiert zu
   modellieren,
3. ein Benchmark mit realistischen Hochschuldaten akzeptable Laufzeit und
   Speichernutzung zeigt.

Die grössere langfristige Herausforderung ist voraussichtlich nicht WASM,
sondern die **saubere Formulierung und Erklärbarkeit der vielen
Stundenplanregeln**.

## 8. Bezug zum aktuellen Stand

`sample-data.js` und `schedule-model.js` (bereits erstellt) sind der
Rohentwurf für Schritt 3.2/3.3 – als Nächstes: Domänenmodell/SolverInput
sauber trennen (3.2) und den Constraint-Katalog (3.3) einführen, statt
Restriktionen direkt in den Modul-Objekten zu belassen.
