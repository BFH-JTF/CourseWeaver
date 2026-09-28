/**
 * Stufe 1 + F – geteilt zwischen Pipeline (Python) und CourseWeaver (Vue/TS).
 * Pipeline schreibt JSON nach diesem Schema, CourseWeaver konsumiert es nur.
 */

export type IrmLevel = 'I' | 'R' | 'M'

export interface LearningCycle {
  id: string // z.B. "mod-mba-strategy-lc3"
  moduleId: string
  /** Nummer 1..6 (aus structuralElement interpretiert) */
  number: 1 | 2 | 3 | 4 | 5 | 6
  /** z.B. "Learning Cycle 3" oder "On-Campus 2" (Kap. 1 Spalte "Structural Elements") */
  structuralElement: string
  /** Kap. 1 Excel-Spalten */
  learningGoals: string
  mainContent: string
  didactics: string
  assignmentDescription?: string
  assignmentType?: 'Graded' | 'Pass/Fail' | 'Non-graded'
  gradingPercentage?: number
  /** KW-Range aus der Excel-Erste-Spalte, z.B. "KW 39-40" — für die LC-Zeilen-Badges */
  calendarWeek?: string
  /** Titel alias (alte Verwendung 'title') — optional, derived */
  title?: string
  /** combined goals+content (alias) — für Backward compat */
  content?: string
  level?: IrmLevel // manuell oder vom LLM vorgeschlagen (Kap. 5.2)
  semester?: number
  sourceFile: string
  sourceRow: number
  version: string
}

export interface CurriculumModule {
  id: string
  name: string
  /** FK auf StudyProgram.id — vor dem Speichern aufgelöst, KEIN Freitext-Duplikat (Kap. 12.4/13) */
  studyProgramId: string
  /** Semester-Nummer — aus Dateiname vorgeschlagen (z.B. DBA_Module_Concept_Semester2_FS2027.xlsx), von der Person bestätigt */
  semester: number
  /** humano-lesbarer Programmname (derived aus der gewählten StudyProgram für Anzeige/ alte REST-Konsumenten) */
  program?: string
  code?: string // Module-Kürzel (aus Titelzeile des Concepts, z.B. "DBF")
  ects?: number
  learningCycles: LearningCycle[] // genau 6 für vollständige Module
}

export interface ContentOverlap {
  moduleA: string
  lcA: number
  moduleB: string
  lcB: number
  similarityScore: number // aus Schritt C
  llmJudgement: 'none' | 'partial' | 'high' // aus Schritt E
  explanation: string
  confidence: number
}

export interface CurriculumMappingReport {
  program: string
  generatedAt: string
  overlaps: ContentOverlap[]
  /** Modul-Paar → Maximalwert aller LC-Paare zweier Module */
  moduleHeatmap?: Record<string, number>
}
