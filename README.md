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
  - [Option A: Local Development](#option-a-local-development)
  - [Option B: Docker (Production-like)](#option-b-docker-production-like)
  - [Initial In-App Configuration & Login](#initial-in-app-configuration--login)
- [Available Scripts](#available-scripts)
- [Data Structures & Documentation](#data-structures--documentation)
- [License](#license)

---

## Overview

Designing, maintaining, and scheduling modern higher education curricula involves complex interdependencies between academic goals, student competencies, faculty availability, physical infrastructure, and accreditation standards.

CourseWeaver provides an integrated solution tailored to university workflows:
- **Academic Hierarchy**: Structures educational offerings across Departments, Programs, Degrees, Modules, and Lessons.
- **Outcome-Based Education**: Links course lessons directly to learning objectives, competencies, and proofs of competency.
- **Infrastructure-Aware Scheduling**: Matches course requirements (room type, capacity, AV equipment, accessibility) with available campus facilities.
- **Curriculum Versioning**: Supports curriculum updates without disrupting existing student cohorts.

---

## Key Features

### Curriculum Mapping & Versioning
- **Hierarchical Structure**: Model academic structure from **Departments** &rarr; **Study Programs** &rarr; **Degrees** &rarr; **Modules** &rarr; **Lessons**.
- **Full CRUD Management**: Add, edit, and delete departments, programs, degrees, and modules through dedicated form dialogs. Search, sort, and filter entries in data tables.
- **CSV Import**: Bulk-import departments, programs, degrees, and modules from CSV files with automatic column mapping and preview.
- **Curriculum Versioning**: Maintain version history for curricula. Fork entire taxonomy and module mappings so that existing student cohorts continue under their admitted curriculum version while new cohorts transition to updated curricula.

### Academic Taxonomy & Competency Framework
- **Multi-Level Taxonomy**: Define and organize standard measuring frameworks:
  - **Competencies**: High-level program learning goals (e.g., analytical thinking, leadership).
  - **Learning Objectives**: Specific, measurable knowledge and skills acquired in modules/lessons.
  - **Proofs of Competency**: Assessment methods (exams, assignments, presentations) verifying competency acquisition.
- **CRUD & CSV Import**: Add, edit, delete, and bulk-import competencies and proofs of competency.

### Module Management & Relationship Constraints
- **Detailed Module Profiles**: Track module codes, ECTS credit points, contact hours, teaching hours, and self-study hours.
- **Inter-Module Relationships**: Define and enforce relational rules between modules:
  - `requires` (Prerequisite: Module A must be completed before Module B)
  - `corequisite` (Co-requisite: Module A must be taken alongside Module B)
  - `forbids` (Exclusion: Module A must not be taken or scheduled concurrently with Module B)
- **Constraint Editor**: Visual constraint editor in the module form dialog for adding/removing module relationships.

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
- **CRUD & CSV Import**: Add, edit, delete, and bulk-import rooms and locations.

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
- **OIDC Authentication**: OpenID Connect (OIDC) / EduID authentication flow supporting any compliant identity provider (docPouch, EduID, Keycloak, etc.).
- **PostgreSQL Persistence**: Data persistence layer built on PostgreSQL using JSONB document storage for flexible semi-structured academic entities.
- **Role-Based Access Control**: Permissions (Administrator vs. standard user) for controlling taxonomy editing, schedule publication, and system administration.

---

## Technology Stack

- **Backend Framework**: [Express.js](https://expressjs.com/) 5 (Node.js REST API with CORS and JSON middleware)
- **Frontend Framework**: [Vue 3](https://vuejs.org/) (Composition API, `<script setup lang="ts">`)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (~5.7)
- **UI & Components**: [Vuetify 4](https://vuetifyjs.com/) & [Material Design Icons (`@mdi/font`)](https://pictogrammers.com/docs/library/mdi/)
- **State Management**: [Pinia](https://pinia.vuejs.org/)
- **Routing**: [Vue Router 4](https://router.vuejs.org/)
- **Build Tool**: [Vite 8](https://vite.dev/)
- **Database & Persistence**: [PostgreSQL 16](https://www.postgresql.org/) with JSONB document storage (with in-memory fallback)
- **Authentication**: OpenID Connect (OIDC) / EduID (with docPouch as a supported identity provider)
- **Containerization**: [Docker](https://www.docker.com/) & Docker Compose
- **Linting**: ESLint with typescript-eslint and eslint-plugin-vue

---

## Project Structure

```text
CourseWeaver/
├── .dockerignore                # Docker build context exclusions
├── .env                         # Environment variables (database, OIDC)
├── Dockerfile                   # Multi-stage production build (Node.js + Vue)
├── docker-compose.yml           # PostgreSQL, app server, and OIDC provider
├── eslint.config.js             # ESLint configuration
├── docs/                        # Specifications and data structure documentation
│   ├── datastructure.curriculum.md  # Core academic entity definitions
│   ├── datastructure.locations.md   # Location JSON & CSV specifications
│   ├── datastructure.rooms.md       # Classroom & equipment specifications
│   ├── datastructure.student_skills.md # Skill categories and proficiency levels
├── index.html                   # HTML entry point
├── package.json                 # Project dependencies and scripts
├── server/                      # Backend Express REST API
│   ├── auth.ts                  # OIDC authentication & admin middleware
│   ├── db.ts                    # PostgreSQL connection pool and JSONB persistence
│   ├── index.ts                 # Express server setup, API routes, static serving
│   ├── routes/
│   │   ├── api.ts               # Generic CRUD REST endpoints (/api/:entity)
│   │   ├── auth.ts              # Auth bootstrap and user management routes
│   │   ├── timetable.ts         # Timetable solver routes
│   │   └── users.ts             # User management routes
│   └── test/
│       └── api.test.ts          # REST API test suite
├── src/                         # Frontend Vue 3 application
│   ├── App.vue                  # Root component with OIDC lifecycle handler
│   ├── main.ts                  # Application bootstrapping
│   ├── components/              # Reusable UI dialogs and components
│   │   ├── CompetencyFormDialog.vue       # Competency add/edit dialog
│   │   ├── CsvImportDialog.vue            # CSV import with column mapping & preview
│   │   ├── DegreeFormDialog.vue           # Degree add/edit dialog
│   │   ├── DepartmentFormDialog.vue       # Department add/edit dialog
│   │   ├── LocationFormDialog.vue         # Location add/edit dialog
│   │   ├── ModuleFormDialog.vue           # Module add/edit dialog (with constraints)
│   │   ├── ProgramFormDialog.vue          # Program add/edit dialog
│   │   ├── ProofOfCompetencyFormDialog.vue # Proof of competency add/edit dialog
│   │   └── RoomFormDialog.vue             # Room add/edit dialog
│   ├── composables/             # Shared business logic and API integrations
│   │   ├── useCompetencies.ts             # Competency CRUD operations
│   │   ├── useCsvImport.ts                # CSV import save logic
│   │   ├── useDegrees.ts                  # Degree CRUD operations
│   │   ├── useDepartments.ts              # Department CRUD operations
│   │   ├── useDocPouch.ts                 # docPouch OIDC compatibility adapter
│   │   ├── useLocations.ts                # Location CRUD operations
│   │   ├── useModules.ts                  # Module CRUD operations
│   │   ├── useOidc.ts                     # OpenID Connect authentication
│   │   ├── usePostgres.ts                 # PostgreSQL JSONB REST API client & settings
│   │   ├── usePrograms.ts                 # Program CRUD operations
│   │   ├── useProofsOfCompetency.ts       # Proof of competency CRUD operations
│   │   ├── useRooms.ts                    # Room CRUD operations
│   │   ├── useTimetableCpSat.ts           # Timetable constraint solver
│   │   └── useTimetableServer.ts          # Timetable server integration
│   ├── layouts/
│   │   └── AppLayout.vue                  # Navigation drawer, app bar, and main layout
│   ├── plugins/
│   │   └── vuetify.ts                     # Vuetify setup and theme configuration
│   ├── router/
│   │   └── index.ts                       # Route definitions and navigation guards
│   ├── stores/                  # Pinia stores
│   │   ├── auth.ts                         # User authentication and admin role state
│   │   └── curriculum.ts                   # Curriculum, module, lesson, and taxonomy store
│   ├── types/                   # TypeScript interface declarations
│   │   ├── competency.ts                  # Competency and skill taxonomy types
│   │   ├── csvImport.ts                    # CSV import configuration types
│   │   ├── curriculum.ts                   # Department, Program, Degree, Module types
│   │   ├── degree.ts                       # Degree re-export
│   │   ├── department.ts                   # Department re-export
│   │   ├── location.ts                     # Location entity definitions
│   │   ├── module.ts                       # Module re-export
│   │   ├── program.ts                      # Program re-export
│   │   ├── proofOfCompetency.ts            # Proof of competency types
│   │   └── room.ts                         # Room, equipment & availability types
│   ├── utils/                   # Utility functions
│   │   ├── curriculumNormalize.ts          # Normalize field aliases on curriculum entities
│   │   ├── csvParser.ts                   # CSV parsing utilities
│   │   ├── csvSchemas.ts                  # CSV import field definitions and transforms
│   │   └── __tests__/csvImport.test.ts    # CSV import unit tests
│   └── views/                   # Application views/screens
│       ├── AdminView.vue                  # System administration and user management
│       ├── CallbackView.vue               # OIDC authentication callback handler
│       ├── ConflictsView.vue              # Conflict detection and resolution view
│       ├── CurriculumView.vue             # Departments, Programs, Degrees, Modules management
│       ├── DashboardView.vue              # Central dashboard overview
│       ├── LoginView.vue                  # OIDC login view
│       ├── ReportsView.vue               # Curriculum reporting and export view
│       ├── RoomsView.vue                 # Rooms and locations management view
│       ├── ScheduleView.vue              # Semester schedule and lecturer assignments
│       ├── SettingsView.vue             # PostgreSQL connection and OIDC provider settings
│       └── TaxonomyView.vue              # Competencies & proofs of competency management
├── tsconfig.app.json            # Frontend TypeScript compiler options
├── tsconfig.json                # Base TypeScript compiler options
├── tsconfig.node.json           # Vite/Node TypeScript compiler options
├── tsconfig.server.json         # Server TypeScript compiler options
└── vite.config.ts              # Vite configuration with Vuetify and /api proxy
```

---

## Getting Started

### Prerequisites

Ensure you have the following installed on your machine:
- **Node.js**: v18.0.0 or later (v20+ recommended)
- **npm**: v9.0.0 or later
- **Docker** and **Docker Compose** (to run the PostgreSQL and OIDC backend services, or for production deployment)

---

### Option A: Local Development

#### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd CourseWeaver
npm install
```

#### 2. Start the Backend Services (PostgreSQL & OIDC)

CourseWeaver uses PostgreSQL for document storage and OIDC for user authentication. A preconfigured `docker-compose.yml` is provided for local development:

```bash
docker compose up postgres doc-pouch -d
```

This starts:
- **PostgreSQL 16**: Port `5432`, database `courseweaver`, with persistent volume in `./postgres-data`
- **Optional OIDC Provider (docPouch)**: Port `3030` on `http://localhost:3030/oidc`

#### 3. Start the Development Server

```bash
npm run dev
```

This starts both the Express backend API (port 3000) and the Vite frontend dev server (port 5173) concurrently. Open your browser at:

```
http://localhost:5173
```

The Vite dev server proxies `/api` requests to the Express backend and `/oidc` requests to docPouch automatically.

---

### Option B: Docker (Production-like)

To run the full application stack (frontend, backend API, PostgreSQL, and OIDC) via Docker:

```bash
docker compose up --build
```

This builds the Vue frontend, bundles it with the Express server, and starts all services:
- **CourseWeaver App**: Port `3000` — serves the built frontend and REST API (`/api`)
- **PostgreSQL 16**: Port `5432`
- **docPouch OIDC**: Port `3030`

Open your browser at:

```
http://localhost:3000
```

The app container automatically connects to PostgreSQL via the internal Docker network (`POSTGRES_HOST: postgres`).

To run only the infrastructure services (PostgreSQL + OIDC) without the app container:

```bash
docker compose up postgres doc-pouch -d
```

---

### Initial In-App Configuration & Login

1. When opening the app for the first time, you will be redirected to the **Server & OIDC Settings** screen (`/settings`).
2. Fill in the connection settings for your OIDC identity provider and PostgreSQL backend:
   - **OIDC Provider**: Select `docPouch` or `EduID / Generic OpenID Connect`
   - **OIDC Issuer URL**: `http://localhost:3030/oidc` (or your EduID/Keycloak issuer endpoint)
   - **OIDC Registration Token**: `TestToken` (when using docPouch OIDC)
   - **PostgreSQL Backend API URL**: `http://localhost:3000/api`
   - **Database Name**: `courseweaver`
3. Click **Save Settings** to persist the configuration.
4. Navigate to the **Login** screen (`/login`) and click **Log in with OIDC** to authenticate.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts both the backend Express REST API server and Vite frontend concurrently. |
| `npm run dev:server` | Starts the Express REST API backend server with live reload (`tsx watch`). |
| `npm run dev:client` | Starts Vite frontend development server with HMR. |
| `npm run build` | Runs TypeScript typecheck (`vue-tsc`) and builds the frontend for production into `dist/`. |
| `npm run start` | Runs the Express REST API backend server (and serves static `dist/` if present). |
| `npm run test` | Runs the REST API integration test suite. |
| `npm run preview` | Locally previews the production frontend build. |
| `npm run typecheck` | Validates TypeScript types across frontend and server codebases. |
| `npm run lint` | Runs ESLint on `src/` for TypeScript and Vue files. |
| `npm run lint:fix` | Runs ESLint with auto-fix on `src/`. |

---

### PostgreSQL JSONB Entity Tables

Academic records and institutional resources are stored in PostgreSQL tables with JSONB document payloads:

| Entity | Table Name | Storage Format | Description |
|---|---|---|---|
| `CURRICULUM_VERSION` | `curriculum_versions` | JSONB | Curriculum versions and parent forks |
| `STUDY_PROGRAM` | `study_programs` | JSONB | Academic study programs |
| `DEPARTMENT` | `departments` | JSONB | Academic departments and faculties |
| `PROGRAM` | `programs` | JSONB | Structured courses of study |
| `DEGREE` | `degrees` | JSONB | Academic degree qualifications |
| `MODULE` | `modules` | JSONB | Modules, ECTS credits, and relationship constraints |
| `SEMESTER` | `semesters` | JSONB | Semesters, dates, and holidays |
| `LESSON` | `lessons` | JSONB | Lessons, taxonomy links, and scheduled sessions |
| `ROOM` | `rooms` | JSONB | Classrooms, capacity, layout, equipment |
| `LOCATION` | `locations` | JSONB | Campuses, buildings, addresses, geo-coordinates |
| `LECTURER` | `lecturers` | JSONB | Faculty profiles and availability slots |
| `TAXONOMY` | `taxonomy_items` | JSONB | Competencies, learning objectives, proofs of competency |
| `COMPETENCY` | `competencies` | JSONB | Competencies and skill taxonomy |
| `PROOF_OF_COMPETENCY` | `proofs_of_competency` | JSONB | Assessment methods and examination formats |

---

## License

This project is developed for educational and academic administration purposes at Bern University of Applied Sciences (BFH). Please refer to the repository license for usage terms.