import type { LearningCycle } from '@/types/curriculumMapping'

export interface LearningCycleEntry {
  id: string
  moduleId: string
  title?: string
  structuralElement?: string
  number?: number
  learningGoals?: string
  mainContent?: string
  level?: 'I' | 'R' | 'M'
}

export interface CurriculumModuleEntry {
  id: string
  name: string
  studyProgramId: string
  semester: number
  credits?: number
  learningCycles: LearningCycleEntry[]
}

export { LearningCycle }
