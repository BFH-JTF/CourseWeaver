/**
 * Kompetenz-Datenmodell (Kap. 15): Kompetenz-Rahmen als eigene, austauschbare
 * Entität — mehrere Sets können nebeneinander existieren (15.1), jede Kompetenz
 * ist via frameworkId eindeutig einem Rahmen zugeordnet.
 */
export type SkillLevel = 'Introduction' | 'Regular' | 'Master' | 'I' | 'R' | 'M'

import type { AclInfo } from '@/types/curriculum'

export interface Competency extends AclInfo {
  id?: string
  _id?: string
  frameworkId: string
  name: string
  category?: string
  topic?: string
  description?: string
  level?: SkillLevel | string
  order?: number
  xMatrixCompetencyId?: string
  yMatrixCompetencyId?: string
}

export interface CompetencyFramework {
  id: string
  /** z.B. "BFH Master-Kompetenzrahmen 2026" */
  name: string
  /** bis zur Auth-Integration (Solver-Review #5) optional */
  ownerId?: string
  /** sichtbar für alle vs. nur für ownerId */
  isShared: boolean
  createdAt: string
}

export type CompetencyExport = Competency[]
