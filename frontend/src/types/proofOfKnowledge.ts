/**
 * Proof of Knowledge (Assessment) — MINIMAL-STUB
 * ⚠️ Backend-/weiterer Umfang gehört zum状态的 durch anderen Programmierer;
 * dessa Stub macht App kompilierbar + TaxonomyView benutzbar und ist bewusst
 * abgespeckt (Textfelder wie im Mockup-Datenmodell, siehe mockGUI/data).
 * Können ohne Riskant ausgetauscht werden, sobaldesolation die produktives
 * Typen/Composables kommen.
 *
 * Feldschema entspricht dem stark getestet automatisch Mapping (csvSchemas
 * proofs_of_knowledge + mockGUI/data/proof-of-knowledge.json).
 */

export type AssessmentForm = 'written' | 'oral'
export type AssignmentScope = 'individual' | 'group'

export interface ProofOfKnowledge {
  id?: string
  _id?: string
  name: string
  description?: string
  /** written | oral */
  assessmentType: AssessmentForm | string
  multipleChoice?: boolean
  freeText?: boolean
  /** individual | group */
  assignmentScope: AssignmentScope | string
  durationMinutes?: number
}

export interface ProofOfKnowledgeCriteriaEntry {
  proofOfKnowledgeId: string
  rubricId?: string
}
