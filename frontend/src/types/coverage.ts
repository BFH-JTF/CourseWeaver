import type { AclInfo } from '@/types/curriculum'

/**
 * Traceability / Abdeckung / Lücken — gemeinsame Typen für alle drei Darstellungen
 * (docs/curriculum-mapping-visualizations.md).
 */

export type CoverageLevel = 'introduced' | 'reinforced' | 'assessed'

export type GapStatus = 'critical' | 'warning' | null

export interface ModuleCompetencyLink extends AclInfo {
  id?: string
  _id?: string
  moduleId: string
  competencyId: string
  level: CoverageLevel
  proofOfCompetencyId?: string
  source?: 'manual' | 'learning-cycle'
}

/** Eine Matrix-Zelle inkl. automatisch abgeleiteter assessed-Stufe. */
export interface CoverageCell {
  moduleId: string
  competencyId: string
  level: CoverageLevel | null
  assessedFromProof: boolean
  proofOfCompetencyId?: string
  linkId?: string
}

export interface CompetencyCoverage {
  competencyId: string
  introducedCount: number
  reinforcedCount: number
  assessedCount: number
}

export interface CoverageModule {
  id: string
  name: string
  code?: string
  semester?: number | null
  programIds: string[]
}

export interface CoverageCompetency {
  id: string
  name: string
  frameworkId: string
  category?: string
  level?: string
  order?: number
}

export interface CoverageFramework {
  id: string
  name: string
}

export interface CoverageScope {
  program: string | null
  framework: string | null
  moduleCount: number
  competencyCount: number
}

export interface CoverageResponse {
  scope: CoverageScope
  links: ModuleCompetencyLink[]
  cells: CoverageCell[]
  modules: CoverageModule[]
  competencies: CoverageCompetency[]
  frameworks: CoverageFramework[]
  coverage: CompetencyCoverage[]
  proofs: Array<{ id: string; name: string; moduleIds: string[] }>
}

/** Zeile der Kennzahlen-/Lücken-Ansicht (rein abgeleitet aus CoverageResponse). */
export interface CoverageRow {
  competencyId: string
  name: string
  frameworkId: string
  category?: string
  introducedCount: number
  reinforcedCount: number
  assessedCount: number
  total: number
  gapStatus: GapStatus
}
