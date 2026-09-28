/**
 * Stufe 1 — Fachliches Domänenmodell Curriculum Mapping (Kap. 1)
 * LearningCycle bildet exakt die Excel-Spalten ab (Learning Goals, Main Content,
 * Didactics & Tools, Description Assignment, Assignment Type, Grading Percentage).
 * Der Modul-Kern (id/name/program) kommt aus dem gemeinsamen core/domain.ts.
 *
 * Stufe 2 (Kap. 2) — MappingInput: validierte Kandidaten, analog SolverInput.
 */
import type { ModuleCore } from '../core/domain.js'

export type { Program, Instructor, ModuleCore } from '../core/domain.js'

/** I-R-M-Logik: Introduce, Reinforce, Master */
export type IrmLevel = 'I' | 'R' | 'M'

export type AssignmentType = 'Graded' | 'Pass/Fail' | 'Non-graded'

/**
 * LearningCycle — 1:1 auf die Excel-Spalten bzw. aus parseModuleConceptWorkbook.
 * Assessment-Felder sind für die Constructive-Alignment-Bewertung nötig (Kap. 5).
 */
export interface LearningCycle {
  id: string // stabile ID, CASE-Freundlich
  moduleId: string // Module.id aus core/domain.ts
  structuralElement: string // z.B. "Learning Cycle 3" oder "On-Campus 2"
  learningGoals: string // Spalte "Learning Goals"
  mainContent: string // Spalte "Main Content"
  didactics: string // Spalte "Didactics & Tools"
  assignmentDescription?: string // Spalte "Description Assignment"
  assignmentType?: AssignmentType
  gradingPercentage?: number
  /** manuell erfasst oder vom LLM vorgeschlagen (Kap. 5.2/9) */
  level?: IrmLevel
  semester?: number
  sourceFile: string
  sourceRow: number
  version: string
}

/** Ein Modul im Blickwinkel der Inhaltsanalyse + die zugehörigen LCs aus Spaltennummerierung analog Template */
export interface CurriculumModule extends ModuleCore {
  learningCycles: LearningCycle[]
}

// ---------------------------------------------------------------------------
// Stufe 2 — MappingInput (validiert, analog SolverInput)
// ---------------------------------------------------------------------------

export interface OverlapCandidate {
  cycleAId: string
  cycleBId: string
  embeddingSimilarity: number
  lexicalSimilarity?: number
}

export interface AlignmentCandidate {
  cycleId: string // jeder LC mit gesetztem level und assignmentType
}

export interface MappingInput {
  /** Stufe-1-Filter: topK pro LC + Schwellenwert */
  overlapCandidates: OverlapCandidate[]
  /** alle LCs mit vollständigen Assessment-Feldern */
  alignmentCandidates: AlignmentCandidate[]
  /** LC-Index (Speicher/Lookup) — für RookieAssessors */
  cyclesById: Map<string, LearningCycle>
  program: string
}

export interface BuildMappingInputOptions {
  /** Ähnlichkeitsschwelle (Kap. 2.1 Schritt 4b / Kap. 9 Kalibrierung); Embedding-Default 0.75 */
  threshold?: number
  /** topK ähnliche Paare pro LC behalten (Kap. 2.1 Schritt 4a); Default 5 */
  topK?: number
  /** Paare aus demselben Modul einschliessen (Kap. 2.1 Schritt 6); Default false —
   *  zwei LCs desselben Moduls sind interne Modulstruktur, keine Redundanz-Frage */
  includeSameModule?: boolean
}

export interface MappingConfig {
  threshold: number
  topK: number
  includeSameModule: boolean
}
