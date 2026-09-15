# CourseWeaver — MockGUI

Curriculum-mapping Mock für BFH Master's programs (inspiriert von Ilios).
Standalone Mock, gebaut auf Vue 3 + Vite + DocPouch + OIDC — dient als
funktionaler Prototyp bevor Logik/Daten ins Produktiv-Projekt `src/` wandern.

## Ordnerstruktur (neu)

```
mockGUI/
├── README.md               # diese Datei (Überblick + Migration)
├── gui/                    # Mock-GUI — direkt in src/ verschiebbar
│   ├── mockup.html         # Vollständiger Mock (inline DATA aus ../data/)
│   └── useAuth.js          # OIDC-Login (DocPouch) — Vorlage für src/composables/useAuth.ts
├── data/                   # Mock-Daten (JSON) — durch echte Daten/API ersetzbar
│   ├── department.json
│   ├── programs.json
│   ├── semesters.json
│   ├── modules.json        # 64 Module + program_id/semester_id/instructor_ids
│   ├── contact-blocks.json # 60 Blockwochen (slots: date/weekday/period, room_id)
│   ├── instructors.json    # 75 Dozierende
│   ├── instructor-availability.json
│   ├── locations.json      # 2 Standorte
│   ├── rooms.json          # 4 Räume
│   ├── terms.json, competencies.json, objectives.json, ...
│   └── rubrics.json, assessment-results.json, improvement-actions.json
├── types/                  # TypeScript-Quellenwahrheit — 1:1 nach src/types/ kopierbar
│   ├── program.ts          # Department, Program
│   ├── module.ts           # Module, SchedulingConstraint, ModuleRelationship
│   ├── contact-block.ts    # ContactBlock
│   ├── scheduling.ts       # HalfDaySlot (ContactWeekday: thu/fri/sat)
│   ├── lesson.ts, instructor.ts, semester.ts, location.ts, room.ts
│   └── taxonomy.ts, assurance-of-learning.ts
├── docs/
│   ├── data-model.md       # Datenmodell v4 (Hierarchy, Linking, AoL)
│   └── Willcox_Mapping outcomes.pdf
└── config/
    └── docker-compose.yml  # Dedizierte DocPouch-Instanz (Port 3032)
```

**Analogie zum Produktiv-Projekt:**

| mockGUI | Produktiv (`CourseWeaver/`) |
|---|---|
| `gui/mockup.html` | `src/views/*.vue` + `src/components/*` |
| `gui/useAuth.js` | `src/composables/useAuth.ts` / `src/stores/auth.ts` |
| `types/*.ts` | `src/types/*.ts` |
| `data/*.json` | DocPouch/PostgreSQL JSONB (`curriculum_versions`, `modules`, ...) |
| `config/docker-compose.yml` | `docker-compose.yml` (Root) |
| `docs/data-model.md` | `docs/datastructure.*.md` |

## Mock-GUI starten

```bash
# Option A: statisch (ohne Build)
python -m http.server 5174 --directory mockGUI
# -> http://localhost:5174/gui/mockup.html

# Option B: wie gehabt inline DATA (kein fetch nötig)
# Öffne direkt: mockGUI/gui/mockup.html im Browser
```

`gui/mockup.html` enthält `const DATA = {...}` als Snapshot aus `../data/*.json`.
Für dynamisches Laden (empfohlen für echte Daten) im `<script>` auf `fetch('../data/...')` umstellen — Kommentar in `gui/mockup.html:283` zeigt das Pattern.

## Echte Daten übernehmen

1. **JSON ersetzen:** Dateien in `data/` durch Exporte aus DocPouch/PostgreSQL ersetzen — gleiche Dateinamen, gleiche `_id`-Referenzen beibehalten.
2. **Oder API anbinden:** In `gui/mockup.html` den `DATA`-Block durch `fetch('/api/...')` ersetzen und `types/*.ts` als Interfaces weiterverwenden.
3. **Schema prüfen:** `docs/data-model.md` beschreibt Linking-Strategie (hierarchisch vs. loose referencing) und Konflikt-Checks (`checkScheduleConflicts`).

## GUI ins Produktiv-Projekt verschieben

```bash
# Types
cp mockGUI/types/*.ts CourseWeaver/src/types/

# GUI (HTML -> Vue)
# mockup.html als Vorlage für src/views/ScheduleView.vue etc. zerlegen
cp mockGUI/gui/useAuth.js CourseWeaver/src/composables/useAuth.js

# Daten (nur für Dev)
cp mockGUI/data/*.json CourseWeaver/public/mock-data/  # optional
```

Danach `src/types/room.ts` und `src/types/location.ts` mit den bereits vorhandenen Produktiv-Types abgleichen (sind inhaltlich identisch).

## DocPouch / OIDC

- `config/docker-compose.yml` nutzt `bfh-jtf/docpouch:latest` auf Port `3032` (Produktiv: `3030`).
- In `gui/useAuth.js` `OIDC_CONFIG` mit eigenem Client füllen (EduID/Keycloak) — siehe `docs/data-model.md` Next Steps.
- `ANONYMOUS_DOCUMENTS_ENABLED` absichtlich nicht gesetzt (Lesson aus SWOT/Pulsmesser).

## Nächste Schritte

1. `OIDC_CONFIG` in `gui/useAuth.js` füllen
2. Image/Tag in `config/docker-compose.yml` gegen SWOT-Config prüfen
3. DocPouch-Structures aus `docs/data-model.md` anlegen
4. `checkScheduleConflicts()` (Instructor/Room/Module-Exclusion) implementieren
