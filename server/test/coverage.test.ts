/**
 * Unit-Tests Traceability / Abdeckung / Lücken
 * (docs/curriculum-mapping-visualizations.md):
 *  - effectiveLevel: 'assessed' wird AUTOMATISCH aus ProofOfCompetency abgeleitet,
 *    nie manuell gepflegt; Proof muss aber wirklich zum Modul gehören
 *  - buildCells: leere Zelle bleibt neutral (level null), Parallel-Links gewinnt der höchste
 *  - aggregateCoverage: Zählung je Kompetenz und Stufe
 *  - gapStatus: total === 0 -> critical, assessedCount === 0 -> warning, sonst keine Lücke
 *  - Eine Datenquelle: Matrix, Kennzahlen und Lücken sind Projektionen desselben Ergebnisses
 */
import assert from 'node:assert'
import {
  buildCells,
  aggregateCoverage,
  effectiveLevel,
  gapStatus,
  totalCoverage,
  isCoverageLevel,
  type CompetencyCoverage,
  type ModuleCompetencyLink,
  type ProofRef,
} from '../coverage/domain.js'

console.log('--- Starting Coverage Unit Tests ---')

const link = (moduleId: string, competencyId: string, level: ModuleCompetencyLink['level']): ModuleCompetencyLink => ({
  id: `mcl-${moduleId}-${competencyId}`,
  moduleId,
  competencyId,
  level,
  source: 'manual',
})

// 1. isCoverageLevel
{
  assert.strictEqual(isCoverageLevel('introduced'), true)
  assert.strictEqual(isCoverageLevel('reinforced'), true)
  assert.strictEqual(isCoverageLevel('assessed'), true)
  assert.strictEqual(isCoverageLevel('master'), false)
  assert.strictEqual(isCoverageLevel(undefined), false)
  console.log('✓ coverage level validation passed')
}

// 2. effectiveLevel: manuell gepflegte Stufe bleibt erhalten, solange kein Nachweis existiert
{
  const proofs: ProofRef[] = []
  const r = effectiveLevel(link('m1', 'c1', 'introduced'), proofs, 'm1', 'c1')
  assert.strictEqual(r.level, 'introduced')
  assert.strictEqual(r.proofOfCompetencyId, undefined)
  console.log('✓ manual introduced level kept without proof passed')
}

// 3. effectiveLevel: Nachweis im selben Modul hebt automatisch auf 'assessed'
{
  const proofs: ProofRef[] = [
    { id: 'p1', name: 'Leistungsnachweis A', competencyIds: ['c1'], moduleIds: ['m1'] },
  ]
  const r = effectiveLevel(link('m1', 'c1', 'introduced'), proofs, 'm1', 'c1')
  assert.strictEqual(r.level, 'assessed')
  assert.strictEqual(r.proofOfCompetencyId, 'p1')
  console.log('✓ assessed derived automatically from proof passed')
}

// 4. effectiveLevel: Nachweis eines ANDEREN Moduls darf nicht wirken
{
  const proofs: ProofRef[] = [
    { id: 'p1', name: 'Nachweis Modul 2', competencyIds: ['c1'], moduleIds: ['m2'] },
  ]
  const r = effectiveLevel(link('m1', 'c1', 'reinforced'), proofs, 'm1', 'c1')
  assert.strictEqual(r.level, 'reinforced')
  assert.strictEqual(r.proofOfCompetencyId, undefined)
  console.log('✓ proof of other module ignored passed')
}

// 5. effectiveLevel: Nachweis prüft andere Kompetenz -> keine Aufwertung
{
  const proofs: ProofRef[] = [
    { id: 'p1', name: 'Nachweis', competencyIds: ['c2'], moduleIds: ['m1'] },
  ]
  const r = effectiveLevel(link('m1', 'c1', 'introduced'), proofs, 'm1', 'c1')
  assert.strictEqual(r.level, 'introduced')
  console.log('✓ proof for other competency ignored passed')
}

// 6. effectiveLevel: kein Link -> neutrale Zelle (keine Sonderfarbe)
{
  const r = effectiveLevel(null, [{ id: 'p', name: 'x', competencyIds: ['c1'], moduleId: 'm1' }], 'm1', 'c1')
  assert.strictEqual(r.level, null)
  console.log('✓ empty cell stays neutral passed')
}

// 7. buildCells: vollständiges Raster moduleIds x competencyIds
{
  const cells = buildCells(
    [link('m1', 'c1', 'introduced'), link('m1', 'c2', 'reinforced')],
    [{ id: 'p1', name: 'Nachweis', competencyIds: ['c2'], moduleIds: ['m1'] }],
    ['m1', 'm2'],
    ['c1', 'c2'],
  )
  assert.strictEqual(cells.size, 4, '2 Module x 2 Kompetenzen = 4 Zellen')
  assert.strictEqual(cells.get('m1::c1')!.level, 'introduced')
  assert.strictEqual(cells.get('m1::c1')!.assessedFromProof, false)
  assert.strictEqual(cells.get('m1::c2')!.level, 'assessed')
  assert.strictEqual(cells.get('m1::c2')!.assessedFromProof, true)
  assert.strictEqual(cells.get('m1::c2')!.proofOfCompetencyId, 'p1')
  assert.strictEqual(cells.get('m2::c1')!.level, null)
  assert.strictEqual(cells.get('m2::c2')!.level, null)
  console.log('✓ buildCells grid + assessed source passed')
}

// 8. buildCells: bei zwei Links je Paar gewinnt der höhere Wert
{
  const cells = buildCells(
    [link('m1', 'c1', 'introduced'), { ...link('m1', 'c1', 'reinforced'), id: 'dup' }],
    [],
    ['m1'],
    ['c1'],
  )
  assert.strictEqual(cells.get('m1::c1')!.level, 'reinforced')
  console.log('✓ duplicate links keep highest level passed')
}

// 9. aggregateCoverage: Zählung je Kompetenz über alle Module
{
  const cells = buildCells(
    [
      link('m1', 'c1', 'introduced'),
      link('m2', 'c1', 'reinforced'),
      link('m1', 'c2', 'introduced'),
    ],
    [{ id: 'p1', name: 'Nachweis', competencyIds: ['c1'], moduleIds: ['m1'] }],
    ['m1', 'm2'],
    ['c1', 'c2'],
  )
  const coverage = aggregateCoverage([...cells.values()], ['c1', 'c2'])
  const c1 = coverage.find(c => c.competencyId === 'c1')!
  assert.strictEqual(c1.assessedCount, 1, 'm1 wird von c1 geprüft')
  assert.strictEqual(c1.reinforcedCount, 1)
  assert.strictEqual(c1.introducedCount, 0, 'assessed ersetzt introduced, nicht addiert')
  const c2 = coverage.find(c => c.competencyId === 'c2')!
  assert.strictEqual(c2.introducedCount, 1)
  assert.strictEqual(totalCoverage(c2), 1)
  console.log('✓ aggregateCoverage counts per level passed')
}

// 10. gapStatus: die drei Fälle der Spezifikation
{
  const critical: CompetencyCoverage = { competencyId: 'c1', introducedCount: 0, reinforcedCount: 0, assessedCount: 0 }
  const warning: CompetencyCoverage = { competencyId: 'c2', introducedCount: 2, reinforcedCount: 1, assessedCount: 0 }
  const ok: CompetencyCoverage = { competencyId: 'c3', introducedCount: 1, reinforcedCount: 1, assessedCount: 2 }
  assert.strictEqual(gapStatus(critical), 'critical')
  assert.strictEqual(gapStatus(warning), 'warning')
  assert.strictEqual(gapStatus(ok), null)
  console.log('✓ gapStatus critical / warning / none passed')
}

// 11. Eine Datenquelle: Matrix-Zellen und Lückenstatus bleiben konsistent
{
  const cells = buildCells(
    [link('m1', 'c1', 'introduced')],
    [],
    ['m1'],
    ['c1', 'c2'],
  )
  const coverage = aggregateCoverage([...cells.values()], ['c1', 'c2'])
  const gaps = coverage.filter(c => gapStatus(c) !== null)
  // c1: abgedeckt, aber nie geprüft -> warning; c2: nirgends abgedeckt -> critical
  assert.deepStrictEqual(gaps.map(c => c.competencyId).sort(), ['c1', 'c2'])
  assert.strictEqual(gaps.find(c => c.competencyId === 'c1')!.gapStatus, undefined)
  assert.strictEqual(gapStatus(gaps.find(c => c.competencyId === 'c1')!), 'warning')
  assert.strictEqual(gapStatus(gaps.find(c => c.competencyId === 'c2')!), 'critical')
  console.log('✓ gaps derive from the same cells as the matrix passed')
}

console.log('--- All Coverage Unit Tests Passed ---')
