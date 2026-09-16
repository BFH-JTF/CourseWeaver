import type { AclInfo } from '@/types/curriculum'

export type AssessmentForm = 'written' | 'oral'
export type AssignmentScope = 'individual' | 'group'

export interface ProofOfKnowledge extends AclInfo {
  id?: string
  _id?: string
  name: string
  description?: string
  assessmentType?: AssessmentForm | string // written / oral
  multipleChoice?: boolean // multiple choice questions
  freeText?: boolean // free text questions
  assignmentScope?: AssignmentScope | string // individual or group assignment
  durationMinutes?: number // duration of test in minutes
  created_at?: string
  updated_at?: string
}

export type ProofOfKnowledgeExport = ProofOfKnowledge[]
