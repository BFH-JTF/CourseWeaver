# CourseWeaver

**CourseWeaver** is a web-based curriculum mapping, academic scheduling, and room planning platform designed for higher education institutions and business schools. It enables academic administrators, program managers, and faculty to model degree programs, map competencies and learning outcomes, manage teaching facilities and equipment, plan semester schedules, detect scheduling conflicts, and generate reports for accreditation.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
  - [Curriculum Mapping & Versioning](#curriculum-mapping--versioning)
  - [Academic Taxonomy & Competency Framework](#academic-taxonomy--competency-framework)
  - [Module Management & Relationship Constraints](#module-management--relationship-constraints)
  - [Rooms & Locations Planning](#rooms--locations-planning)
  - [Semester Scheduling & Timetabling](#semester-scheduling--timetabling)
  - [Conflict Detection & Resolution](#conflict-detection--resolution)
  - [Curriculum Analysis & Accreditation Reporting](#curriculum-analysis--accreditation-reporting)
  - [Authentication & Access Control](#authentication--access-control)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [1. Clone and Install Dependencies](#1-clone-and-install-dependencies)
  - [2. Start the Backend Services (DocPouch)](#2-start-the-backend-services-docpouch)
  - [3. Start the Frontend Development Server](#3-start-the-frontend-development-server)
  - [4. Initial In-App Configuration & Login](#4-initial-in-app-configuration--login)
- [Available Scripts](#available-scripts)
- [Data Structures & Documentation](#data-structures--documentation)
- [License](#license)

---

## Overview

Designing, maintaining, and scheduling modern higher education curricula involves complex interdependencies between academic goals, student competencies, faculty availability, physical infrastructure, and accreditation standards.

CourseWeaver provides an integrated solution tailored to university workflows:
- **Academic Hierarchy**: Structures educational offerings across Departments, Programs, Degrees, Modules, and Lessons.
- **Outcome-Based Education**: Links course lessons directly to learning objectives, competencies, and proofs of knowledge.
- **Infrastructure-Aware Scheduling**: Matches course requirements (room type, capacity, AV equipment, accessibility) with available campus facilities.
- **Curriculum Versioning**: Supports curriculum updates without disrupting existing student cohorts.

---

## Key Features

### Curriculum Mapping & Versioning
- **Hierarchical Structure**: Model academic structure from **Departments** &rarr; **Study Programs** &rarr; **Degrees** &rarr; **Modules** &rarr; **Lessons**.
- **Curriculum Versioning**: Maintain version history for curricula. Fork entire taxonomy and module mappings so that existing student cohorts continue under their admitted curriculum version while new cohorts transition to updated curricula.

### Academic Taxonomy & Competency Framework
- **Multi-Level Taxonomy**: Define and organize standard measuring frameworks:
  - **Competencies**: High-level program learning goals (e.g., analytical thinking, leadership).
  - **Learning Objectives**: Specific, measurable knowledge and skills acquired in modules/lessons.
  - **Proofs of Knowledge**: Assessment methods (exams, assignments, presentations) verifying competency acquisition.
- **Lesson Mapping**: Directly link taxonomy elements and assessment proofs to individual lessons.

### Module Management & Relationship Constraints
- **Detailed Module Profiles**: Track module codes, ECTS credit points, contact hours, teaching hours, and self-study hours.
- **Inter-Module Relationships**: Define and enforce relational rules between modules:
  - `requires` (Prerequisite: Module A must be completed before Module B)
  - `corequisite` (Co-requisite: Module A must be taken alongside Module B)
  - `forbids` (Exclusion: Module A must not be taken or scheduled concurrently with Module B)

### Rooms & Locations Planning
- **Location Management**: Track campuses, buildings, street addresses, and geographic coordinates (latitude/longitude).
- **Classroom & Facility Profiles**:
  - **Room Types**: Lecture halls, classrooms, computer labs, laboratories, seminar rooms, and custom spaces.
  - **Capacities**: Seating capacity, accessible seating, desk count, and standing capacity.
  - **Layout & Furniture**: Room layouts (rows, U-shape, boardroom, laboratory benches, computer workstations), movable furniture, group work suitability, and floor area ($m^2$).
  - **AV & Tech Equipment**: Whiteboards, smartboards, projectors, document cameras, lecterns, audio systems, streaming cameras (fixed, tracking, PTZ with 720p/1080p/4K), and video conferencing systems.
  - **Connectivity**: Wi-Fi, wired network speed (Mbps), power outlets, and display connections (HDMI, DisplayPort, USB-C, VGA, etc.).
  - **Accessibility**: Step-free access, accessible doors and seating, hearing loops, Braille signage, and nearby accessible restrooms.
  - **Availability & Maintenance**: Configurable weekly availability schedules, blocked periods, and maintenance tracking.
- **CSV Import & Export**: Bulk import and export capabilities for locations and room inventories.

### Semester Scheduling & Timetabling
- **Semester Configuration**: Define semester identifiers, start/end dates, official holidays, and special academic dates.
- **Faculty Availability**: Manage lecturer profiles, departments, and weekly availability time slots.
- **Session Scheduling**: Assign lecturers, rooms, dates, and times to individual module lessons based on constraint formats (block weeks, weekly sessions, bi-weekly classes).

### Conflict Detection & Resolution
- Automated detection of scheduling conflicts:
  - Lecturer double-booking across concurrent sessions.
  - Room double-booking or room feature mismatches (e.g., student group size exceeding seat capacity, missing required lab equipment).
  - Violation of module prerequisite/co-requisite timing constraints.

### Curriculum Analysis & Accreditation Reporting
- **Gap & Duplication Analysis**: Identify untaught competencies or redundant course content across study programs.
- **Accreditation Exports**: Generate reports and exports suitable for academic accreditation (e.g., AACSB, EQUIS) and internal institutional quality reviews.

### Authentication & Access Control
- Integration with **[DocPouch](https://github.com/BFH-JTF/doc-pouch)** for document storage and real-time updates.
- OpenID Connect (OIDC) / EduID authentication flow.
- Role-based permissions (Administrator vs. standard user) for controlling taxonomy editing, schedule publication, and system administration.

---

## Technology Stack

- **Frontend Framework**: [Vue 3](https://vuejs.org/) (Composition API, `<script setup lang="ts">`)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (~5.7)
- **UI & Components**: [Vuetify 3/4](https://vuetifyjs.com/) & [Material Design Icons (`@mdi/font`)](https://pictogrammers.com/docs/library/mdi/)
- **State Management**: [Pinia](https://pinia.vuejs.org/)
- **Routing**: [Vue Router 4](https://router.vuejs.org/)
- **Build Tool**: [Vite 8](https://vite.dev/)
- **Backend / Database / Auth**: [DocPouch](https://github.com/BFH-JTF/doc-pouch) via [`docpouch-client`](https://www.npmjs.com/package/docpouch-client) (OIDC / JWT & Real-time WebSockets)
- **Containerization**: [Docker](https://www.docker.com/) & Docker Compose

---

## Project Structure

```text
CourseWeaver/
├── docker-compose.yml          # Local DocPouch service configuration
├── docs/                       # Specifications and data structure documentation
│   ├── datastructure.curriculum.md  # Core academic entity definitions (Program, Degree, Module)
│   ├── datastructure.locations.md   # Location JSON & CSV specifications
│   ├── datastructure.rooms.md       # Classroom & equipment specifications
│   └── starting_desc.md             # Project requirements and Ilios domain comparison
├── index.html                  # HTML entry point
├── package.json                # Project dependencies and scripts
├── src/
│   ├── App.vue                 # Root component
│   ├── main.ts                 # Application bootstrapping
│   ├── components/             # Reusable UI dialogs and components
│   │   ├── LocationFormDialog.vue   # Location add/edit dialog
│   │   └── RoomFormDialog.vue       # Room details add/edit dialog
│   ├── composables/            # Shared business logic and API integrations
│   │   ├── useDocPouch.ts           # DocPouch client, OIDC auth & server settings
│   │   ├── useLocations.ts          # Location management and CSV parser
│   │   └── useRooms.ts              # Room management and CSV parser
│   ├── layouts/
│   │   └── AppLayout.vue            # Navigation drawer, app bar, and main layout
│   ├── plugins/
│   │   └── vuetify.ts               # Vuetify setup and theme configuration
│   ├── router/
│   │   └── index.ts                 # Route definitions and navigation guards
│   ├── stores/                 # Pinia stores
│   │   ├── auth.ts                  # User authentication and admin role state
│   │   └── curriculum.ts            # Curriculum, module, lesson, and taxonomy store
│   ├── types/                  # TypeScript interface declarations
│   │   ├── location.ts              # Location entity definitions
│   │   └── room.ts                  # Comprehensive room, equipment & availability types
│   └── views/                  # Application views/screens
│       ├── AdminView.vue            # System administration and user management
│       ├── CallbackView.vue         # OIDC authentication callback handler
│       ├── ConflictsView.vue        # Conflict detection and resolution view
│       ├── CurriculumView.vue       # Curriculum versions & study programs
│       ├── DashboardView.vue        # Central dashboard overview
│       ├── LoginView.vue            # DocPouch login view
│       ├── ModulesView.vue          # Module list and constraint view
│       ├── ReportsView.vue          # Curriculum reporting and export view
│       ├── RoomsView.vue            # Rooms and locations management view
│       ├── ScheduleView.vue         # Semester schedule and lecturer assignments
│       ├── SettingsView.vue         # Server connection and OIDC token settings
│       └── TaxonomyView.vue         # Competencies, learning objectives & proofs of knowledge
├── tsconfig.json               # TypeScript compiler options
└── vite.config.ts              # Vite configuration with Vuetify plugin
```

---

## Getting Started

### Prerequisites

Ensure you have the following installed on your machine:
- **Node.js**: v18.0.0 or later (v20+ recommended)
- **npm**: v9.0.0 or later
- **Docker** and **Docker Compose** (to run the local DocPouch backend)

---

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd CourseWeaver
npm install
```

---

### 2. Start the Backend Services (DocPouch)

CourseWeaver uses DocPouch for authentication and persistent document storage. A preconfigured `docker-compose.yml` is provided for local development:

```bash
docker compose up -d
```

This starts DocPouch on `http://localhost:3030` with:
- Persistent database storage in `./docpouch-db`
- Application logs in `./docpouch-log`
- Default OIDC registration token: `TestToken`

---

### 3. Start the Frontend Development Server

```bash
npm run dev
```

Once started, open your browser at:
```
http://localhost:5173
```

---

### 4. Initial In-App Configuration & Login

1. When opening the app for the first time, you will be redirected to the **Server Settings** screen (`/settings`).
2. Fill in the connection settings for your local DocPouch server:
   - **DocPouch URL**: `http://localhost:3030` (or leave port blank if included in URL)
   - **Port**: `3030` (or `0` if included in the URL)
   - **OIDC Registration Token**: `TestToken`
3. Click **Save & Register** to register the frontend client with DocPouch.
4. Navigate to the **Login** screen (`/login`) and click **Log in with DocPouch** to authenticate via OIDC.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts Vite local development server with HMR. |
| `npm run build` | Runs TypeScript typecheck (`vue-tsc`) and builds for production into `dist/`. |
| `npm run preview` | Locally previews the production build. |
| `npm run typecheck` | Validates TypeScript types across the codebase without emitting files. |

---

## Data Structures & Documentation

For in-depth domain models, schemas, and export formats, refer to the documents in [`docs/`](./docs/):

- **[`docs/starting_desc.md`](./docs/starting_desc.md)**: High-level requirements, functional vision, and comparison with the [Ilios](https://github.com/ilios) curriculum system.
- **[`docs/datastructure.curriculum.md`](./docs/datastructure.curriculum.md)**: Conceptual definitions for Departments, Study Programs, Degrees, and Modules.
- **[`docs/datastructure.locations.md`](./docs/datastructure.locations.md)**: JSON structure and CSV header format for Location entities.
- **[`docs/datastructure.rooms.md`](./docs/datastructure.rooms.md)**: JSON specification and CSV column definitions for classrooms, layout configurations, AV equipment, connectivity, and accessibility features.

### DocPouch Document Types

Entities in CourseWeaver are categorized by DocPouch document types (`type` and `subType`):

| Entity | Type | SubType | Description |
|---|---|---|---|
| `CURRICULUM_VERSION` | `100` | `1` | Curriculum versions and parent forks |
| `STUDY_PROGRAM` | `100` | `2` | Academic study programs |
| `MODULE` | `100` | `3` | Modules and relationship constraints |
| `SEMESTER` | `100` | `4` | Semesters, dates, and holidays |
| `LESSON` | `100` | `5` | Lessons, taxonomy links, and scheduled sessions |
| `ROOM` | `101` | `1` | Classrooms, capacity, layout, equipment |
| `LECTURER` | `101` | `2` | Faculty profiles and availability slots |
| `LOCATION` | `101` | `3` | Campuses, buildings, addresses, geo-coordinates |
| `TAXONOMY` | `102` | `1` | Competencies, learning objectives, proofs of knowledge |

---

## License

This project is developed for educational and academic administration purposes at Bern University of Applied Sciences (BFH). Please refer to the repository license for usage terms.
