/**
 * Constructive Alignment–Datenmodell für das Curriculum Mapping eines Masterprogramms.
 *
 * Datenquellen: generische Entity-Tabellen des Servers (/api/:entity), Schema wie
 * mockGUI/data (programs, terms, modules, objectives, objective-mappings, proof-of-knowledge).
 */
import type { LearningCycle } from '@/types/curriculumMapping'

/** Strategisches Themenfeld (terms.category === 'strategic_theme') */
export interface StrategicTheme {
  _id: string
  title: string
  category?: string
  statement?: string
  description?: string
}

/** Modul mit Programm-Zuordnung und strategischen Themenfeldern */
export interface MappingModule {
  _id: string
  /** title (mock) oder name (app-Schema) */
  title?: string
  name?: string
  code?: string
  credits?: number
  program_id?: string
  studyProgramIds?: string[]
  semester_id?: string
  /** Strategische Themenfelder */
  strategic_theme_ids?: string[]
  learningCycles?: LearningCycle[]
}

/** Lernziel / Kompetenz (objectives), mit BFH-Rationale */
export interface MappingObjective {
  _id: string
  text?: string
  title?: string
  description?: string
  rationale?: string
  /** 'module' | 'program' | ... gemäss jetzigem Schema */
  level?: string
  competency_id?: string
}

/**
 * Constructive-Alignment-Mapping: ein Lernziel wird in einem Modul
 * auf einer I-R-M-Stufe gefördert, via Lernaktivität unterrichtet
 * und über einen Leistungsnachweis beurteilt.
 */
export type IrmStage = 'introduce' | 'reinforce' | 'master'

export interface ObjectiveMapping {
  _id: string
  objective_id: string
  module_id: string
  stage: 'introduce' | 'reinforce' | 'master' | string
  learning_activity?: string
  assessment_ids?: string[]
}

/** Leistungsnachweis (proof-of-knowledge) für die Alignment-Prüfung */
export interface MappingProof {
  _id: string
  title?: string
  name?: string
  description?: string
}

export const IRM_STAGE_LABELS: Record<string, string> = {
  introduce: 'I – Introduction',
  reinforce: 'R – Regular',
  master: 'M – Master',
}

export const IRM_STAGE_ORDER: (keyof typeof IRM_STAGE_LABELS)[] = ['introduce', 'reinforce', 'master']

/** Darzustellendes Alignment-Chain-Element */
export interface AlignmentEntry {
  mapping: ObjectiveMapping
  objective?: MappingObjective
  module?: MappingModule
  proofs: MappingProof[]
  issues: AlignmentIssue[]
}

export interface AlignmentIssue {
  severity: 'warning' | 'error'
  reason: string
}
