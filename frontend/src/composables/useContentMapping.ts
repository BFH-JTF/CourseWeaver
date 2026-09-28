/**
 * Content-Overlap & Alignment (Kap. 2/5/8/10) — Client für die Batch-Pipeline
 * /api/mapping/* (Backend rechnet, Vue konsumiert nur JSON — wie beim Solver).
 */
import { ref, computed } from 'vue'

export interface MappingCatalogEntry {
  id: string
  color: string
  reviewPriority: string
  description: string
}

export interface OverlapEntryLike {
  id: string
  moduleAId: string
  moduleBId: string
  cycleAId: string
  cycleBId: string
  embeddingSimilarity: number
  lexicalSimilarity?: number
  reviewPriority: 'high' | 'medium' | 'low' | 'none'
  status: string
  assessment: {
    relationship: string
    overlapA: number
    overlapB: number
    sharedConcepts?: string[]
    differences?: string[]
    irmA?: string
    irmB?: string
    isProgression?: boolean
    rationale: string
    confidence: number
  }
}

export interface AlignmentEntryLike {
  id: string
  cycleId: string
  moduleId: string
  claimedLevel: string
  priority: string
  status: string
  observation: {
    observedCognitiveLevel: string
    assessmentMatchesLevel: boolean
    mismatch?: string | null
    rationale: string
  }
}

export interface LearningCycleDto {
  semester?: number
  id: string
  moduleId: string
  structuralElement: string
  learningGoals: string
  mainContent: string
  didactics: string
  assignmentDescription?: string
  assignmentType?: string
  level?: 'I' | 'R' | 'M'
}

export interface CurriculumMapDto {
  program: string
  generatedAt: string
  moduleMatrix: Array<{
    moduleAId: string
    moduleBId: string
    topRelationship: string
    maxSimilarity: number
    openReviewCount: number
    entries: OverlapEntryLike[]
  }>
  progression: Array<{
    cycleId: string
    moduleId: string
    level: string
    learningGoals: string
    alignmentHint?: string
  }>
  coverage: Array<{
    competency: string
    introduce: string[]
    reinforce: string[]
    master: string[]
    alignmentIssues: Array<{ cycleId: string; issue: string }>
  }>
  openReview: {
    overlaps: OverlapEntryLike[]
    alignments: AlignmentEntryLike[]
  }
}

const COLOR_MAP: Record<string, string> = {
  red: 'error',
  amber: 'warning',
  green: 'success',
  grey: 'grey',
}

export function useContentMapping() {
  const cycles = ref<LearningCycleDto[]>([])
  const map = ref<CurriculumMapDto | null>(null)
  const catalogRelationships = ref<MappingCatalogEntry[]>([])
  const catalogAlignment = ref<MappingCatalogEntry[]>([])
  const mode = ref<'ollama' | 'heuristic'>('heuristic')

  const loading = ref(false)
  const error = ref<string | null>(null)

  async function loadCatalog() {
    const res = await fetch('/api/mapping/catalog')
    if (res.ok) {
      const json = (await res.json()) as {
        relationships: MappingCatalogEntry[]
        alignmentIssues: MappingCatalogEntry[]
        configured?: { ollama: boolean }
      }
      catalogRelationships.value = json.relationships ?? []
      catalogAlignment.value = json.alignmentIssues ?? []
      if (json.configured?.ollama) mode.value = 'ollama'
    }
  }

  /**
   * Kap. 13 (Step 4): Der gesamte gespeicherte Bestand eines Programms ist Grundlage
   * der Analyse — importierte Dateien reichen den Bestand an, sie triggern ihn nicht.
   * Lesen: curriculum_modules (mit nested learningCycles), flatten zu DTOs.
   */
  interface CurriculumModuleDto {
    _id?: string
    id: string
    name: string
    studyProgramId: string
    semester?: number
    learningCycles: LearningCycleDto[]
  }
  async function loadCycles(): Promise<LearningCycleDto[]> {
    const res = await fetch('/api/curriculum_modules')
    let stored: CurriculumModuleDto[] = res.ok ? await res.json() : []
    // Backward compat: falls die alte learning_cycles-Flat-Tabelle gefüllt ist, merge
    if (!stored.length) {
      const legacy = await fetch('/api/learning_cycles').then(r => (r.ok ? r.json() : []))
      return legacy as LearningCycleDto[]
    }
    return stored.flatMap(m =>
      // nested LCs sind vollständige LearningCycle-Daten; id/moduleId/semester vom Modul halten
      m.learningCycles.map((lc) => ({ ...lc, id: lc.id, moduleId: m.id, semester: m.semester })),
    )
  }

  async function refresh(program?: string, threshold?: number): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await loadCatalog()
      cycles.value = await loadCycles()
      if (!cycles.value.length) {
        map.value = null
        return
      }
      const res = await fetch('/api/mapping/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cycles: cycles.value,
          program: program ?? cycles.value[0]?.moduleId ?? 'default',
          threshold,
        }),
      })
      if (!res.ok) throw new Error(`analyse HTTP ${res.status}`)
      map.value = (await res.json()) as CurriculumMapDto
    } catch (e: any) {
      error.value = e.message || 'Mapping-Analyse fehlgeschlagen'
    } finally {
      loading.value = false
    }
  }

  /** Review-Entscheidung persistieren (Versionierung/Audit Trail im Backend). */
  async function sendReview(
    assessmentKey: string,
    decision: 'confirmed' | 'rejected',
    decidedBy = 'manual',
  ): Promise<void> {
    const res = await fetch('/api/mapping/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assessmentKey, decision, decidedBy }),
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(body.error ?? 'Review nicht gespeichert')
    }
  }

  function colorOf(relationship: string): string {
    const e = catalogRelationships.value.find((x) => x.id === relationship)
    return COLOR_MAP[e?.color ?? 'grey'] ?? 'grey'
  }

  function alignmentColorOf(issue?: string | null): string {
    const e = issue ? catalogAlignment.value.find((x) => x.id === issue) : undefined
    return COLOR_MAP[e?.color ?? 'grey'] ?? 'grey'
  }

  function descriptionOf(relationship: string): string {
    return catalogRelationships.value.find((x) => x.id === relationship)?.description ?? relationship
  }

  function cyclesFor(entry: OverlapEntryLike): { a: LearningCycleDto | undefined; b: LearningCycleDto | undefined } {
    return {
      a: cycles.value.find((c) => c.id === entry.cycleAId),
      b: cycles.value.find((c) => c.id === entry.cycleBId),
    }
  }

  const matrixRows = computed(() => map.value?.moduleMatrix ?? [])
  const openOverlaps = computed(() => map.value?.openReview.overlaps ?? [])
  const openAlignments = computed(() => map.value?.openReview.alignments ?? [])
  const coverageRows = computed(() => map.value?.coverage ?? [])
  const progressionRows = computed(() => map.value?.progression ?? [])

  return {
    cycles,
    matrixRows,
    openOverlaps,
    openAlignments,
    coverageRows,
    progressionRows,
    catalogRelationships,
    catalogAlignment,
    mode,
    loading,
    error,
    refresh,
    colorOf,
    descriptionOf,
    alignmentColorOf,
    cyclesFor,
    review: sendReview,
  }
}
