/**
 * Curriculum Mapping — Traceability / Abdeckung / Lücken (docs/curriculum-mapping-visualizations.md).
 *
 * Basis-Datenmodell für ALLE drei Darstellungen: ein ModuleCompetencyLink je
 * (Modul, Kompetenz). Darstellung 2 (Kennzahlen) und 3 (Lücken) sind reine
 * Aggregation/Filter auf denselben Links — sie werden bewusst nicht separat
 * gespeichert, sonst laufen die Ansichten auseinander (Abschnitt 5 der Spezifikation).
 */

/** Die drei diskreten Abdeckungsstufen. Reihenfolge ist bedeutungstragend (introduced < reinforced < assessed). */
export type CoverageLevel = 'introduced' | 'reinforced' | 'assessed'

export const COVERAGE_LEVELS: CoverageLevel[] = ['introduced', 'reinforced', 'assessed']

export function isCoverageLevel(value: unknown): value is CoverageLevel {
  return typeof value === 'string' && (COVERAGE_LEVELS as string[]).includes(value)
}

/**
 * Eine explizite Verknüpfung "Modul deckt Kompetenz in dieser Tiefe ab".
 *
 * `level: 'assessed'` wird NICHT manuell gepflegt: sobald zu einem Modul ein
 * ProofOfCompetency existiert, der dieselbe competencyId referenziert, setzt
 * `effectiveLevel()` den Link automatisch auf 'assessed' und liefert die
 * proofId für den Tooltip-Verweis. Manuell gepflegt werden nur
 * introduced/reinforced (Abschnitt 1 der Spezifikation).
 */
export interface ModuleCompetencyLink {
  id: string
  moduleId: string
  competencyId: string
  /** Manuell gepflegte Stufe. 'assessed' wird bei effectiveLevel() automatisch abgeleitet. */
  level: Exclude<CoverageLevel, 'assessed'> | CoverageLevel
  /** Gesetzt, wenn der Link aus einem ProofOfCompetency abgeleitet wurde (effectiveLevel). */
  proofOfCompetencyId?: string
  /** Quelle der Verknüpfung: manuell gepflegt oder aus Lernzyklus-Inhalten abgeleitet. */
  source?: 'manual' | 'learning-cycle'
  created_at?: string
  updated_at?: string
}

/** Eine Zelle der Traceability-Matrix: effektive Stufe inkl. Herkunftsnachweis. */
export interface CoverageCell {
  moduleId: string
  competencyId: string
  level: CoverageLevel | null
  /** true, wenn die Stufe aus einem ProofOfCompetency stammt (nicht manuell gepflegt). */
  assessedFromProof: boolean
  proofOfCompetencyId?: string
  linkId?: string
}

/** Abdeckung je Kompetenz — rein abgeleitete Aggregation der Links (Abschnitt 3). */
export interface CompetencyCoverage {
  competencyId: string
  introducedCount: number
  reinforcedCount: number
  assessedCount: number
}

/** Lückenstatus einer Kompetenz (Abschnitt 4). */
export type GapStatus = 'critical' | 'warning' | null

export function gapStatus(c: CompetencyCoverage): GapStatus {
  const total = c.introducedCount + c.reinforcedCount + c.assessedCount
  if (total === 0) return 'critical'          // nirgends abgedeckt
  if (c.assessedCount === 0) return 'warning'  // abgedeckt, aber nie geprüft
  return null                                 // keine Lücke
}

export function totalCoverage(c: CompetencyCoverage): number {
  return c.introducedCount + c.reinforcedCount + c.assessedCount
}

/**
 * Ein ProofOfCompetency in der Form, wie sie in `proofs_of_competency` liegt.
 * `moduleId` wird beim Laden aus `modules.proofOfCompetencyIds` bzw. der
 * Legacy-Spalte `module_id` ergänzt (ProofOfCompetency besitzt im aktuellen
 * Modell keine eigene Modul-FK, siehe docs/courseWeaverERD.mermaid).
 */
export interface ProofRef {
  id: string
  name: string
  competencyIds: string[]
  moduleId?: string
  moduleIds?: string[]
}

function proofCoversModule(proof: ProofRef, moduleId: string): boolean {
  if (proof.moduleId === moduleId) return true
  return Array.isArray(proof.moduleIds) && proof.moduleIds.includes(moduleId)
}

/**
 * Effektive Stufe eines Links: 'assessed' gewinnt immer, und zwar automatisch,
 * wenn ein zum Modul gehörender Kompetenznachweis dieselbe Kompetenz prüft.
 * Manuell gepflegte Stufen bleiben introduced/reinforced.
 */
export function effectiveLevel(
  link: Pick<ModuleCompetencyLink, 'level'> | null | undefined,
  proofs: ProofRef[],
  moduleId: string,
  competencyId: string,
): { level: CoverageLevel | null; proofOfCompetencyId?: string } {
  if (!link) return { level: null }
  const proof = proofs.find(p => proofCoversModule(p, moduleId) && p.competencyIds.includes(competencyId))
  if (proof) return { level: 'assessed', proofOfCompetencyId: proof.id }
  const manual = isCoverageLevel(link.level) ? link.level : null
  return { level: manual }
}

/** Baut die Matrix-Zellen aus Link-Liste + Proofs (die eigentliche Datenquelle). */
export function buildCells(
  links: ModuleCompetencyLink[],
  proofs: ProofRef[],
  moduleIds: string[],
  competencyIds: string[],
): Map<string, CoverageCell> {
  const byPair = new Map<string, ModuleCompetencyLink>()
  for (const l of links) {
    const key = `${l.moduleId}::${l.competencyId}`
    const prev = byPair.get(key)
    // Bei Mehrfach-Links gewinnt der höchstwertige, damit nichts an Abdeckung verloren geht.
    if (!prev || rankLevel(l.level) > rankLevel(prev.level)) byPair.set(key, l)
  }
  const cells = new Map<string, CoverageCell>()
  for (const moduleId of moduleIds) {
    for (const competencyId of competencyIds) {
      const key = `${moduleId}::${competencyId}`
      const link = byPair.get(key)
      const { level, proofOfCompetencyId } = effectiveLevel(link, proofs, moduleId, competencyId)
      cells.set(key, {
        moduleId,
        competencyId,
        level,
        assessedFromProof: level === 'assessed',
        proofOfCompetencyId,
        linkId: link?.id,
      })
    }
  }
  return cells
}

function rankLevel(level: unknown): number {
  if (level === 'assessed') return 3
  if (level === 'reinforced') return 2
  if (level === 'introduced') return 1
  return 0
}

/** Aggregation der Zellen zu Abdeckung je Kompetenz (Darstellung 2, reine Ableitung). */
export function aggregateCoverage(cells: CoverageCell[], competencyIds: string[]): CompetencyCoverage[] {
  const acc = new Map<string, CompetencyCoverage>()
  for (const id of competencyIds) {
    acc.set(id, { competencyId: id, introducedCount: 0, reinforcedCount: 0, assessedCount: 0 })
  }
  for (const cell of cells.values()) {
    const entry = acc.get(cell.competencyId)
    if (!entry || !cell.level) continue
    if (cell.level === 'introduced') entry.introducedCount++
    else if (cell.level === 'reinforced') entry.reinforcedCount++
    else entry.assessedCount++
  }
  return [...acc.values()]
}
