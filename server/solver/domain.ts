/**
 * Stufe 1 — Fachliches Domänenmodell
 * Das, was Menschen im Kopf haben. Entspricht sample-data.js als Typen.
 * Keine Solver-Artefakte, keine CpModel-Variablen.
 */

export interface Program {
  id: string
  name: string
}

export interface Instructor {
  id: string
  name: string
  userId?: string
  departmentId?: string
  moduleIds?: string[]
}

export interface Room {
  id: string
  name: string
  capacity: number
}

export interface RoomAvailability {
  id: string
  roomId: string
  weekId?: string
  weekday: string
  startTime: string
  endTime: string
}

export interface Week {
  id: string
  semesterId: string
  semesterWeek: number
  startDate: string
  endDate: string
  daysOff?: string[]
}

export interface ScheduleEntry {
  id: string
  weekId: string
  moduleIds: string[]
  roomIds: string[]
  classIds: string[]
  lecturerIds: string[]
  weekday: string
  startTime: string
  endTime: string
}

export interface OnCampusDay {
  id: string
  date: string // ISO-Datum YYYY-MM-DD
  week: number // Kalenderwoche
  weekday: 'Donnerstag' | 'Freitag' | 'Samstag'
  phase: 'main' | 'final'
}

export type SlotType = 'vormittag' | 'nachmittag' | 'abend'

export interface Restriction {
  id: string // stabile ID, siehe constraintCatalog (3.3)
  category: 'hard' | 'soft'
  weight?: number // nur bei 'soft' – falls undefined, gilt Katalog-Gewicht
  params?: Record<string, unknown> // z. B. { dates: ['2026-11-14'] }
}

export interface Module {
  id: string
  name: string
  program: string // Program.id
  ects: 3 | 6
  expectedStudents: number
  instructors: string[] // Instructor.id[]
  restrictions: Restriction[]
  competencyIds?: string[]
  proofOfCompetencyIds?: string[]
}

export interface Semester {
  id: string
  name: string
  code?: string
  startDate: string
  endDate: string
}

export interface CurriculumVersion {
  id: string
  name: string
  versionNumber: number
  programId?: string
}
