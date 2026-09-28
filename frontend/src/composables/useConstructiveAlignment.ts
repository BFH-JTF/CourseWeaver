/**
 * Constructive Alignment Mapping (Nav-Punkt "Mapping").
 *
 * Denkt vom Strategischen her:
 *   Strategisches Themenfeld -> Module -> Lernziele (I-R-M) -> Lernaktivität -> Leistungsnachweis
 * Die I-R-M-Logik (Introduction – Regular – Master) wird über alle Master-Module
 * hinweg ausgewertet; fehlende Stufen gelten als Mangel im Constructive Alignment.
 */
import { computed, ref, shallowRef } from 'vue'
import type {
  AlignmentEntry,
  AlignmentIssue,
  IrmStage,
  MappingModule,
  MappingObjective,
  MappingProof,
  ObjectiveMapping,
  StrategicTheme,
} from '@/types/constructiveAlignment'
import { IRM_STAGE_ORDER } from '@/types/constructiveAlignment'

interface Loader {
  loading: boolean
  error: string | null
}

function fetchTable(candidates: string[]): Promise<any[]> {
  const chain = (async () => {
    for (const table of candidates) {
      try {
        const res = await fetch(`/api/${table}`)
        if (!res.ok) continue
        const items = await res.json()
        if (Array.isArray(items) && items.length > 0) return items
      } catch {
        // next candidate
      }
    }
    return []
  })()
  return chain
}

function stageShort(stage: string): string | null {
  switch (stage) {
    case 'introduce':
      return 'I'
    case 'reinforce':
      return 'R'
    case 'master':
      return 'M'
    default:
      return null
  }
}

export function useConstructiveAlignment() {
  const programs = ref<any[]>([])
  const themes = shallowRef<StrategicTheme[]>([])
  const modules = shallowRef<MappingModule[]>([])
  const objectives = shallowRef<MappingObjective[]>([])
  const mappings = shallowRef<ObjectiveMapping[]>([])
  const proofs = shallowRef<MappingProof[]>([])

  const loading = ref(false)
  const error = ref<string | null>(null)

  const selectedProgramId = ref<string | null>(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      const [prog, themesItems, modItems, objItems, mapItems, proofItems] = await Promise.all([
        fetchTable(['programs', 'study_programs']),
        fetchTable(['terms', 'themes']),
        fetchTable(['modules']),
        fetchTable(['objectives', 'taxonomy_items']),
        fetchTable(['objective_mappings', 'objective-mappings']),
        fetchTable(['proof_of_knowledge', 'proof-of-knowledge', 'proofs_of_knowledge']),
      ])
      programs.value = prog
      themes.value = (themesItems as any[]).filter(t => (t.category ?? 'strategic_theme') === 'strategic_theme')
      modules.value = modItems
      objectives.value = objItems
      mappings.value = mapItems
      proofs.value = proofItems
      if (!selectedProgramId.value) {
        selectedProgramId.value = prog[0]?._id ?? prog[0]?.id ?? null
      }
    } catch (e: any) {
      error.value = e.message || 'Fehler beim Laden der Mapping-Daten'
    } finally {
      loading.value = false
    }
  }

  function programName(program: any): string {
    return program?.title ?? program?.name ?? '?'
  }

  function moduleName(module: MappingModule): string {
    return module?.title ?? module?.name ?? '?'
  }

  const programModules = computed(() => {
    const pid = selectedProgramId.value
    return modules.value.filter(m => {
      if (pid == null) return false
      return m.program_id === pid || (Array.isArray(m.studyProgramIds) && m.studyProgramIds.includes(pid))
    })
  })

  /** Themes → im Programm abgedeckte Module */
  const themesInProgram = computed(() => {
    const covered = new Set<string>()
    for (const m of programModules.value) {
      for (const tid of m.strategic_theme_ids ?? []) covered.add(tid)
    }
    return themes.value.filter(t => covered.has(t._id))
  })

  const modulesByTheme = computed(() => {
    const map = new Map<string, MappingModule[]>()
    for (const theme of themesInProgram.value) {
      map.set(
        theme._id,
        programModules.value.filter(m => (m.strategic_theme_ids ?? []).includes(theme._id))
      )
    }
    return map
  })

  const mappingsByProgram = computed(() => {
    const ids = new Set(programModules.value.map(m => m._id))
    return mappings.value.filter(mp => mp.module_id && ids.has(mp.module_id))
  })

  /** objectives assenziert mit Programm-Mappings */
  const objectivesInProgram = computed(() => {
    const ids = new Set(mappingsByProgram.value.map(mp => mp.objective_id))
    return objectives.value.filter(o => ids.has(o._id))
  })

  function objectiveText(o?: MappingObjective): string {
    return o?.text ?? o?.title ?? o?.description ?? '?'
  }

  /** I-R-M-Matrix: objective_id -> module_id -> stage[] */
  const irmStages = computed(() => {
    const grid = new Map<string, Map<string, string[]>>()
    for (const mp of mappingsByProgram.value) {
      if (!IRM_STAGE_ORDER.includes(mp.stage as IrmStage)) continue
      let row = grid.get(mp.objective_id)
      if (!row) {
        row = new Map()
        grid.set(mp.objective_id, row)
      }
      const arr = row.get(mp.module_id) ?? []
      arr.push(mp.stage)
      row.set(mp.module_id, arr)
    }
    return grid
  })

  /** Alignment-Prüfung pro Mapping-Eintrag (Constructive Alignment) */
  function alignmentIssues(mp: ObjectiveMapping, proofList: MappingProof[]): AlignmentIssue[] {
    const issues: AlignmentIssue[] = []
    if (!mp.learning_activity?.trim()) {
      issues.push({ severity: 'warning', reason: 'Keine Lernaktivität erfasst — Lernziel ist nicht im Unterricht verankert.' })
    }
    const proofIds = mp.assessment_ids ?? []
    if (proofIds.length === 0) {
      issues.push({ severity: 'warning', reason: 'Kein Leistungsnachweis verknüpft — Lernziel wird nicht beurteilt.' })
    } else {
      const known = new Set(proofList.map(p => p._id))
      if (!proofIds.some((pid: string) => known.has(pid))) {
        issues.push({ severity: 'error', reason: 'Verknüpfter Leistungsnachweis existiert nicht im Datenbestand.' })
      }
    }
    return issues
  }

  /**_alignment Ketten je Lernziel, konsistent über Module */
  const alignmentChains = computed(() => {
    const chains = new Map<string, AlignmentEntry[]>()
    for (const mp of mappingsByProgram.value) {
      const module = programModules.value.find(m => m._id === mp.module_id)
      const objective = objectives.value.find(o => o._id === mp.objective_id)
      const entry: AlignmentEntry = {
        mapping: mp,
        objective,
        module,
        proofs: proofs.value.filter(p => (mp.assessment_ids ?? []).includes(p._id)),
        issues: alignmentIssues(mp, proofs.value),
      }
      let rows = chains.get(mp.objective_id)
      if (!rows) {
        rows = []
        chains.set(mp.objective_id, rows)
      }
      rows.push(entry)
    }
    return chains
  })

  /** I-R-M-Defizite pro Lernziel, über alle Module des Programms */
  const irmIssuesByObjective = computed(() => {
    const issues = new Map<string, string[]>()
    for (const objective of objectivesInProgram.value) {
      const rows: string[] = []
      const grid = irmStages.value.get(objective._id) ?? new Map<string, string[]>()
      const stages = new Set<string>()
      for (const arr of grid.values()) arr.forEach((s: string) => stages.add(s))
      if (stages.size === 0) {
        rows.push('Kein Mapping auf einer I-R-M-Stufe erfasst.')
      } else {
        if (!stages.has('introduce')) rows.push('Kein "introduce" — Lernziel wird ohne Einführung vorausgesetzt.')
        if (!stages.has('master')) rows.push('Kein "master" — Lernziel wird im Studium nie auf Masterniveau abgeschlossen.')
        if (stages.has('master') && !stages.has('reinforce')) rows.push('Sprung von "introduce" direkt auf "master" — keine Vertiefung (reinforce).')
        if (stages.size === 1 && stages.has('introduce')) rows.push('Nur auf Stufe "introduce" bearbeitet — keine Vertiefung, keine Meisterschaft.')
      }
      if (rows.length) issues.set(objective._id, rows)
    }
    return issues
  })

  function alignmentEntriesByProgramModuleLevel(): AlignmentEntry[] {
    const entries: AlignmentEntry[] = []
    for (const objs of alignmentChains.value.values()) entries.push(...objs)
    return entries
  }

  return {
    // data
    programs,
    themes,
    modules,
    objectives,
    mappings,
    proofs,
    loading,
    error,
    selectedProgramId,
    // computed
    programModules,
    themesInProgram,
    modulesByTheme,
    mappingsByProgram,
    objectivesInProgram,
    irmStages,
    alignmentChains,
    irmIssuesByObjective,
    // helpers
    load,
    programName,
    moduleName,
    objectiveText,
    stageShort,
    alignmentEntriesByProgramModuleLevel,
  }
}

export type { Loader }
