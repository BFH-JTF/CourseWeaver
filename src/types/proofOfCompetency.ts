import type { AclInfo } from '@/types/curriculum'

export type AssessmentForm = 'written' | 'oral'
export type AssignmentScope = 'individual' | 'group'

export interface ProofOfCompetency extends AclInfo {
  id?: string
  _id?: string
  name: string
  description?: string
  assessmentType?: AssessmentForm | string
  multipleChoice?: boolean
  freeText?: boolean
  assignmentScope?: AssignmentScope | string
  durationMinutes?: number
  competencyIds?: string[]
  created_at?: string
  updated_at?: string
}

export type ProofOfCompetencyExport = ProofOfCompetency[]