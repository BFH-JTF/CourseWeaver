import { Router } from 'express'
import { getAllEntities, saveEntity, deleteEntity } from '../db.js'
import {
  buildCells,
  aggregateCoverage,
  isCoverageLevel,
  COVERAGE_LEVELS,
  type CoverageCell,
  type CoverageLevel,
  type ModuleCompetencyLink,
  type ProofRef,
} from '../coverage/domain.js'

/**
 * Traceability / Abdeckung / Lücken (docs/curriculum-mapping-visualizations.md).
 *
 * EIN Datenmodell, drei Renderings: Der GET liefert die vollständige, gescopte
 * Datenbasis (Links + Matrix-Zellen + abgeleitete Kennzahlen + Lückenstatus),
 * damit Matrix, Kennzahlen und Lücken-Ansicht garantiert dieselben Zahlen
 * zeigen. `assessed` wird beim Lesen automatisch aus ProofOfCompetency
 * abgeleitet und muss nie manuell gepflegt werden.
 */
export const coverageRouter = Router()

/** Baut die Proof-Referenzen inkl. Modul-Zuordnung (ProofOfCompetency hat keine eigene Modul-FK). */
function collectProofRefs(
  proofs: any[],
  modules: any[],
  moduleById: Map<string, any>,
): ProofRef[] {
  const proofModuleIds = new Map<string, string[]>()
  for (const m of modules) {
    for (const pid of m.proofOfCompetencyIds ?? []) {
      proofModuleIds.set(String(pid), [...(proofModuleIds.get(String(pid)) ?? []), String(m.id ?? m._id)])
    }
  }
  const refs: ProofRef[] = []
  for (const p of proofs) {
    const id = String(p.id ?? p._id ?? '')
    if (!id) continue
    // Legacy-Feld module_id der Mock-Daten mitlesen.
    const legacyModuleIds = [p.module_id, ...(Array.isArray(p.moduleIds) ? p.moduleIds : [])]
      .filter(Boolean)
      .map(String)
    const referenced = new Set<string>([
      ...(proofModuleIds.get(id) ?? []),
      ...legacyModuleIds,
    ])
    // Proof-Namen enthalten den Modulnamen ("Leistungsnachweis: <Modul>") — als Rückfall.
    for (const [moduleId, mod] of moduleById) {
      if (referenced.has(moduleId)) continue
      const modName = String(mod.name ?? '').trim()
      if (modName && String(p.name ?? '').includes(modName)) referenced.add(moduleId)
    }
    refs.push({
      id,
      name: String(p.name ?? id),
      competencyIds: Array.isArray(p.competencyIds) ? p.competencyIds.map(String) : [],
      moduleIds: [...referenced],
      moduleId: [...referenced][0],
    })
  }
  return refs
}

/**
 * Baut die manuelle Link-Liste. Links, die bereits aus den Lernzyklus-Inhalten
 * (lc_contents.competencies) abgeleitet werden, werden nicht doppelt gespeichert.
 */
function collectDerivedLinks(lcContents: any[]): ModuleCompetencyLink[] {
  const derived: ModuleCompetencyLink[] = []
  for (const c of lcContents) {
    const moduleId = String(c.moduleId ?? '')
    if (!moduleId) continue
    for (const competencyId of (Array.isArray(c.competencies) ? c.competencies : []).map(String)) {
      if (!competencyId) continue
      derived.push({
        id: `lc-${moduleId}-${competencyId}`,
        moduleId,
        competencyId,
        // Aus den Lernzyklus-Inhalten lässt sich keine Introduced/Vertieft-Unterscheidung
        // ableiten, solange keine Stufeninformation vorliegt → konservativ 'introduced'.
        level: 'introduced',
        source: 'learning-cycle',
      })
    }
  }
  return derived
}

function moduleProgramIds(m: any): string[] {
  return [
    m.program_id,
    m.program,
    m.studyProgramId,
    ...(Array.isArray(m.studyProgramIds) ? m.studyProgramIds : []),
    ...(Array.isArray(m.programIds) ? m.programIds : []),
  ].filter(Boolean).map(String)
}

/**
 * GET /api/coverage?program=&framework=
 * Scoping-Filter zuerst (Abschnitt 5): ohne Programmfilter ist die Matrix bei
 * realer Datenmenge weder performant noch lesbar.
 */
coverageRouter.get('/', async (req, res) => {
  try {
    const program = String(req.query.program ?? '').trim()
    const framework = String(req.query.framework ?? '').trim()

    const [modulesRaw, lcContents, competenciesRaw, frameworksRaw, proofsRaw, linksRaw] = await Promise.all([
      getAllEntities('modules'),
      getAllEntities('lc_contents'),
      getAllEntities('competencies'),
      getAllEntities('competency_frameworks').catch(() => [] as any[]),
      getAllEntities('proofs_of_competency').catch(() => [] as any[]),
      getAllEntities('module_competency_links').catch(() => [] as any[]),
    ])

    const allModules = modulesRaw.map(m => ({ ...m, id: String(m.id ?? m._id) }))
    const modules = program
      ? allModules.filter(m => moduleProgramIds(m).includes(program))
      : allModules

    const moduleById = new Map<string, any>(allModules.map(m => [m.id, m]))
    const proofs = collectProofRefs(proofsRaw, allModules, moduleById)

    // Kompetenz-Rahmen: Legacy-Datensätze ohne frameworkId gehören zum Standard-Rahmen.
    const competencies = competenciesRaw
      .map(c => ({ ...c, id: String(c.id ?? c._id), frameworkId: c.frameworkId || 'cf-standard' }))
      .filter(c => (framework ? c.frameworkId === framework : true))

    // Scoping: Kompetenzen zählen nur, wenn sie im Programm auch vorkommen.
    const moduleIds = new Set(modules.map(m => m.id))
    const scopedProofs = proofs.filter(p => (p.moduleIds ?? []).some(id => moduleIds.has(id)) || !p.moduleId)

    const manualLinks: ModuleCompetencyLink[] = []
    for (const l of linksRaw) {
      if (!moduleIds.has(String(l.moduleId))) continue
      if (!isCoverageLevel(l.level)) continue
      manualLinks.push({
        ...l,
        id: String(l.id ?? `${l.moduleId}-${l.competencyId}`),
        moduleId: String(l.moduleId),
        competencyId: String(l.competencyId),
      })
    }
    const derivedLinks = collectDerivedLinks(lcContents.filter(c => moduleIds.has(String(c.moduleId))))

    const links = [...manualLinks, ...derivedLinks]
    const competencyIds = competencies.map(c => c.id)
    const cells = buildCells(links, scopedProofs, [...moduleIds], competencyIds)
    const coverage = aggregateCoverage([...cells.values()], competencyIds)

    res.json({
      scope: {
        program: program || null,
        framework: framework || null,
        moduleCount: modules.length,
        competencyCount: competencies.length,
      },
      // Datenquelle 1: die Links selbst (auch für die Bearbeitung).
      links,
      // Datenquelle 2: die Matrix-Zellen inkl. automatisch abgeleitetem 'assessed'.
      cells: [...cells.values()],
      modules: modules.map(m => ({
        id: m.id,
        name: m.name ?? m.title ?? m.id,
        code: m.code,
        semester: m.semester ?? m.semesterNumber ?? null,
        programIds: moduleProgramIds(m),
      })),
      competencies: competencies.map(c => ({
        id: c.id,
        name: c.name ?? c.title ?? c.id,
        frameworkId: c.frameworkId,
        category: c.category,
        level: c.level,
        order: c.order,
      })),
      frameworks: frameworksRaw.map(f => ({ id: f.id ?? f._id, name: f.name ?? f.id })),
      // Abgeleitete Aggregationen (Darstellung 2 und 3) — nie separat gespeichert.
      coverage,
      proofs: scopedProofs.map(p => ({ id: p.id, name: p.name, moduleIds: p.moduleIds ?? [] })),
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Abdeckung konnte nicht geladen werden' })
  }
})

/** PUT /api/coverage/link — introduced/reinforced manuell zuordnen (assessed bleibt automatisch). */
coverageRouter.put('/link', async (req, res) => {
  try {
    const { moduleId, competencyId, level } = req.body ?? {}
    if (!moduleId || !competencyId) {
      res.status(400).json({ error: 'moduleId und competencyId sind erforderlich' })
      return
    }
    if (level !== null && level !== undefined && !isCoverageLevel(level)) {
      res.status(400).json({ error: `level muss einer von ${COVERAGE_LEVELS.join(', ')} sein` })
      return
    }
    const id = String(req.body?.id ?? `mcl-${moduleId}-${competencyId}`)
    if (level === null || level === undefined) {
      const removed = await deleteEntity('module_competency_links', id)
      res.json({ saved: 0, removed })
      return
    }
    const saved = await saveEntity('module_competency_links', id, {
      id,
      moduleId: String(moduleId),
      competencyId: String(competencyId),
      level: level as CoverageLevel,
      source: 'manual',
    })
    res.json({ saved: 1, link: saved })
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Link konnte nicht gespeichert werden' })
  }
})

export type { CoverageCell, ModuleCompetencyLink }
