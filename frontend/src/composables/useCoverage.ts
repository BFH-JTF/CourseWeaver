import { computed, ref } from 'vue'
import type {
  CoverageCell,
  CoverageCompetency,
  CoverageFramework,
  CoverageLevel,
  CoverageModule,
  CoverageResponse,
  CoverageRow,
  CompetencyCoverage,
} from '@/types/coverage'

/**
 * Eine Datenquelle, drei Renderings (docs/curriculum-mapping-visualizations.md).
 *
 * Darstellung 1 (Traceability-Matrix), 2 (Abdeckungs-Kennzahlen) und 3 (Lücken)
 * sind ausschließlich unterschiedliche Projektionen desselben CoverageResponse —
 * es gibt hier bewusst KEINE eigene Speicherung je Darstellung, sonst laufen die
 * Ansichten auseinander (Abschnitt 5 der Spezifikation).
 *
 * Bekannte offene Frage der Spezifikation ("Lässt sich introduced/reinforced aus
 * den LearningCycles ableiten?") ist mit `levelSource` beantwortbar: 'proof'
 * heisst automatisch aus dem Kompetenznachweis abgeleitet (= assessed),
 * 'learning-cycle' heisst aus den Lernzyklus-Inhalten übernommen, 'manual' heisst
 * von den Programmverantwortlichen gepflegt.
 */

/** Eine Hue, drei Helligkeitsstufen — ordinale Skala, keine drei Kategoriefarben. */
export const COVERAGE_SCALE: Record<CoverageLevel, { label: string; short: string; className: string; hex: string }> = {
  introduced: { label: 'Eingeführt', short: 'I', className: 'cov-introduced', hex: '#cfe0f5' },
  reinforced: { label: 'Vertieft', short: 'R', className: 'cov-reinforced', hex: '#6f9fd8' },
  assessed: { label: 'Geprüft', short: 'A', className: 'cov-assessed', hex: '#15489b' },
}

export const COVERAGE_LEVEL_ORDER: CoverageLevel[] = ['introduced', 'reinforced', 'assessed']

export function gapStatusOf(c: CompetencyCoverage): 'critical' | 'warning' | null {
  const total = c.introducedCount + c.reinforcedCount + c.assessedCount
  if (total === 0) return 'critical'
  if (c.assessedCount === 0) return 'warning'
  return null
}

export interface MatrixRow {
  moduleId: string
  moduleName: string
  code?: string
  semester: number | null
  cells: Record<string, CoverageCell>
  coveredCount: number
}

export interface CompetencyColumn {
  competencyId: string
  name: string
  frameworkId: string
  category?: string
}

export interface FrameworkGroup {
  frameworkId: string
  name: string
  columns: CompetencyColumn[]
}

export function useCoverage() {
  const data = ref<CoverageResponse | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Scoping-Filter — zwingend vor der Matrix (Abschnitt 2/5 der Spezifikation).
  const selectedProgram = ref<string>('')
  const selectedFramework = ref<string>('')

  /** Verfügbare Programme — aus dem ungefilterten Antwort-Payload, damit der Filter selbst wählbar bleibt. */
  const programs = ref<Array<{ id: string; name: string }>>([])
  const frameworks = ref<CoverageFramework[]>([])

  async function fetchCoverage(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const params = new URLSearchParams()
      if (selectedProgram.value) params.set('program', selectedProgram.value)
      if (selectedFramework.value) params.set('framework', selectedFramework.value)
      const res = await fetch(`/api/coverage?${params.toString()}`)
      if (!res.ok) {
        const t = await res.json().catch(() => null as any)
        throw new Error(`Abdeckung konnte nicht geladen werden: HTTP ${res.status}${t?.error ? ' (' + t.error + ')' : ''}`)
      }
      data.value = (await res.json()) as CoverageResponse
      frameworks.value = data.value.frameworks ?? []
      // Erstes Programm automatisch wählen, sobald nur eines existiert bzw. noch nichts gewählt ist.
      const programIds = [...new Set((data.value.modules ?? []).flatMap(m => m.programIds ?? []))]
      if (!selectedProgram.value && programIds.length === 1) selectedProgram.value = programIds[0]!
    } catch (e: any) {
      error.value = e?.message || 'Abdeckung konnte nicht geladen werden'
      data.value = null
    } finally {
      loading.value = false
    }
  }

  /** Programme-Liste aus allen Modulen — einmalig, unabhängig vom gewählten Filter. */
  async function fetchProgramOptions(): Promise<void> {
    try {
      const res = await fetch('/api/coverage')
      if (!res.ok) return
      const full = (await res.json()) as CoverageResponse
      const names = new Map<string, string>()
      for (const m of full.modules ?? []) {
        for (const pid of m.programIds ?? []) {
          if (!names.has(pid)) names.set(pid, pid)
        }
      }
      programs.value = [...names.entries()].map(([id, name]) => ({ id, name }))
    } catch {
      programs.value = []
    }
  }

  const modules = computed<CoverageModule[]>(() => data.value?.modules ?? [])
  const competencies = computed<CoverageCompetency[]>(() => data.value?.competencies ?? [])
  const cells = computed<CoverageCell[]>(() => data.value?.cells ?? [])
  const proofsById = computed(() => new Map((data.value?.proofs ?? []).map(p => [p.id, p])))

  function cellFor(moduleId: string, competencyId: string): CoverageCell | undefined {
    return data.value?.cells.find(c => c.moduleId === moduleId && c.competencyId === competencyId)
  }

  // ---------------- Darstellung 1: Traceability-Matrix ----------------

  /** Spalten nach Kompetenzrahmen gruppiert — die Matrix ist nach Framework gruppiert. */
  const columnGroups = computed<FrameworkGroup[]>(() => {
    const byFramework = new Map<string, CompetencyColumn[]>()
    for (const c of competencies.value) {
      const list = byFramework.get(c.frameworkId) ?? []
      list.push({
        competencyId: c.id,
        name: c.name,
        frameworkId: c.frameworkId,
        category: c.category,
      })
      byFramework.set(c.frameworkId, list)
    }
    return [...byFramework.entries()]
      .map(([frameworkId, cols]) => ({
        frameworkId,
        name: frameworkName(frameworkId),
        columns: cols.sort((a, b) => a.name.localeCompare(b.name, 'de')),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'))
  })

  const matrixColumns = computed<CompetencyColumn[]>(() => columnGroups.value.flatMap(g => g.columns))

  function frameworkName(id: string): string {
    return frameworks.value.find(f => f.id === id)?.name
      ?? (id === 'cf-standard' ? 'Standard-Rahmen' : id)
  }

  const matrixRows = computed<MatrixRow[]>(() => [...modules.value].map(m => {
    const row: MatrixRow = {
      moduleId: m.id,
      moduleName: m.name,
      code: m.code,
      semester: m.semester ?? null,
      cells: {},
      coveredCount: 0,
    }
    for (const col of matrixColumns.value) {
      const cell = cellFor(m.id, col.competencyId)
      if (cell) {
        row.cells[col.competencyId] = cell
        if (cell.level) row.coveredCount++
      }
    }
    return row
  }).sort((a, b) => (a.semester ?? 99) - (b.semester ?? 99) || a.moduleName.localeCompare(b.moduleName, 'de')))

  /** Modul x Kompetenz als flache Liste — Pflicht-Tabellen-Fallback (Barrierefreiheit). */
  const matrixTableRows = computed(() => {
    const rows: Array<{
      id: string
      moduleName: string
      competencyName: string
      frameworkName: string
      level: CoverageLevel | null
      assessedFromProof: boolean
      proofName?: string
    }> = []
    for (const row of matrixRows.value) {
      for (const col of matrixColumns.value) {
        const cell = row.cells[col.competencyId]
        if (!cell?.level) continue
        rows.push({
          id: `${row.moduleId}-${col.competencyId}`,
          moduleName: row.moduleName,
          competencyName: col.name,
          frameworkName: frameworkName(col.frameworkId),
          level: cell.level,
          assessedFromProof: cell.assessedFromProof,
          proofName: cell.proofOfCompetencyId ? proofsById.value.get(cell.proofOfCompetencyId)?.name : undefined,
        })
      }
    }
    return rows
  })

  // ---------------- Darstellung 2: Abdeckungs-Kennzahlen ----------------

  type SortKey = 'total' | 'introducedCount' | 'reinforcedCount' | 'assessedCount' | 'name'

  const sortKey = ref<SortKey>('total')
  const sortAscending = ref(true)

  /** Aufsteigend nach Gesamtabdeckung = schwächste Kompetenzen oben (der eigentliche Nutzen). */
  const metricRows = computed<CoverageRow[]>(() => {
    const nameById = new Map(competencies.value.map(c => [c.id, c]))
    const rows: CoverageRow[] = (data.value?.coverage ?? []).map(c => ({
      competencyId: c.competencyId,
      name: nameById.get(c.competencyId)?.name ?? c.competencyId,
      frameworkId: nameById.get(c.competencyId)?.frameworkId ?? 'cf-standard',
      category: nameById.get(c.competencyId)?.category,
      introducedCount: c.introducedCount,
      reinforcedCount: c.reinforcedCount,
      assessedCount: c.assessedCount,
      total: c.introducedCount + c.reinforcedCount + c.assessedCount,
      gapStatus: gapStatusOf(c),
    }))
    const dir = sortAscending.value ? 1 : -1
    return rows.sort((a, b) => {
      if (sortKey.value === 'name') return dir * a.name.localeCompare(b.name, 'de')
      const ka = sortKey.value as keyof CoverageRow
      const va = typeof a[ka] === 'number' ? (a[ka] as number) : 0
      const vb = typeof b[ka] === 'number' ? (b[ka] as number) : 0
      return dir * (va - vb) || a.name.localeCompare(b.name, 'de')
    })
  })

  function toggleSort(key: SortKey): void {
    if (sortKey.value === key) sortAscending.value = !sortAscending.value
    else {
      sortKey.value = key
      sortAscending.value = key !== 'name'
    }
  }

  // ---------------- Darstellung 3: Lücken-Ansicht ----------------

  const gapsOnly = ref(false)
  const gapRows = computed<CoverageRow[]>(() => metricRows.value.filter(r => r.gapStatus !== null))
  /** Darstellung 3 ist ein Filter auf Darstellung 2 — keine eigene Datenhaltung. */
  const visibleMetricRows = computed<CoverageRow[]>(() => (gapsOnly.value ? gapRows.value : metricRows.value))

  const gapSummary = computed(() => ({
    critical: metricRows.value.filter(r => r.gapStatus === 'critical').length,
    warning: metricRows.value.filter(r => r.gapStatus === 'warning').length,
    ok: metricRows.value.filter(r => r.gapStatus === null).length,
  }))

  // ---------------- Bearbeitung (nur introduced/reinforced manuell) ----------------

  async function saveLink(moduleId: string, competencyId: string, level: CoverageLevel | null): Promise<void> {
    const res = await fetch('/api/coverage/link', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moduleId, competencyId, level }),
    })
    if (!res.ok) {
      const t = await res.json().catch(() => null as any)
      throw new Error(t?.error ?? `Link konnte nicht gespeichert werden (HTTP ${res.status})`)
    }
    await fetchCoverage()
  }

  /** Zyklus durch die Stufen: leer → introduced → reinforced → (assessed nur per Proof) → leer. */
  function nextLevel(current: CoverageLevel | null, assessed: boolean): CoverageLevel | null {
    if (assessed) return 'reinforced'
    if (current === null) return 'introduced'
    if (current === 'introduced') return 'reinforced'
    return null
  }

  return {
    data, loading, error,
    selectedProgram, selectedFramework, programs, frameworks,
    fetchCoverage, fetchProgramOptions,
    modules, competencies, cells,
    cellFor, frameworkName,
    columnGroups, matrixColumns, matrixRows, matrixTableRows,
    metricRows, visibleMetricRows, gapsOnly, gapRows, gapSummary,
    sortKey, sortAscending, toggleSort,
    proofsById,
    saveLink, nextLevel,
  }
}
