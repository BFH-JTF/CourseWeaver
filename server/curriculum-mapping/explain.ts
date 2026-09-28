/**
 * Stufe 4 — fachliches Ergebnis (Kap. 2/5/8/9)
 * runAssessors(): Stufe 3 — Roh-Assessments mit Concurrency-Limiter + Retry
 * + Fortschritts-Log (Kap. 7).
 * explainCurriculumMap(): Stufe 4 — Modul-zu-Modul-Matrix mit Drill-down-
 * Entries, Progressionsansicht (I-R-M inkl. Alignment-Hinweis), Coverage Map
 * und GETRENNTEN offenen Prüflisten (Overlap vs. Alignment, Kap. 5).
 */

import type { IrmLevel, LearningCycle, ModuleCore, MappingInput, OverlapCandidate } from './domain.js'
import type {
  AlignmentAssessment,
  AlignmentAssessor,
  LimitFn,
  OverlapAssessment,
  OverlapAssessor,
  ProgressLog,
} from './assessors.js'
import { withRetry, assessReviewPriority, pairKey } from './assessors.js'
import { ALIGNMENT_CATALOG, RELATIONSHIP_CATALOG, type ReviewPriority } from './catalog.js'

// Review-Status-Lebenszyklus (Kap. 9): AI suggested -> Pending review ->
// Confirmed/Rejected -> Published; versioniert mit Audit Trail (history).
export type ReviewStatus = 'ai_suggested' | 'pending_review' | 'confirmed' | 'rejected' | 'published'

export interface MappingResultBase {
  id: string
  status: ReviewStatus
  version: string
  history: Array<{ at: string; by: string; action: string; note?: string }>
}

export interface OverlapEntry extends MappingResultBase {
  type: 'overlap'
  moduleAId: string
  moduleBId: string
  cycleAId: string
  cycleBId: string
  assessment: OverlapAssessment
  embeddingSimilarity: number
  lexicalSimilarity?: number
  reviewPriority: ReviewPriority
}

export interface AlignmentEntry extends MappingResultBase {
  type: 'alignment'
  cycleId: string
  moduleId: string
  claimedLevel: IrmLevel
  observation: AlignmentAssessment
  priority: ReviewPriority
}

/** Primäransicht (Kap. 8): Modul-zu-Modul-Matrix, Drill-down über `entries` */
export interface ModulePairSummary {
  moduleAId: string
  moduleBId: string
  topRelationship: string
  maxSimilarity: number
  openReviewCount: number
  entries: OverlapEntry[]
}

/** Coverage-Map (Kap. 8): Kompetenz × Einführung/Verstärkung/Vertiefung/Assessment */
export interface CoverageCol {
  competency: string
  introduce: string[]
  reinforce: string[]
  master: string[]
  alignmentIssues: Array<{ cycleId: string; issue: string }>
}

export interface CurriculumMap {
  program: string
  generatedAt: string
  version: string
  moduleMatrix: ModulePairSummary[]
  progression: Array<{
    cycleId: string
    moduleId: string
    level: IrmLevel
    learningGoals: string
    alignmentHint?: string
  }>
  coverage: CoverageCol[]
  openReview: {
    overlaps: OverlapEntry[]
    alignments: AlignmentEntry[]
  }
}

export interface RunMappingOptions {
  limit: LimitFn
  overlapAssessor: OverlapAssessor
  alignmentAssessor: AlignmentAssessor
  log?: ProgressLog
}

/** Stufe 3: Bewerter laufen lassen (Limitierung, Retry, Fortschritts-Log). */
export async function runAssessors(
  input: MappingInput,
  opts: RunMappingOptions,
): Promise<{ overlaps: OverlapAssessment[]; alignments: AlignmentAssessment[] }> {
  const total = input.overlapCandidates.length + input.alignmentCandidates.length
  let done = 0

  const overlapJobs = input.overlapCandidates.map((cand: OverlapCandidate) =>
    opts.limit(async () => {
      const a = input.cyclesById.get(cand.cycleAId)
      const b = input.cyclesById.get(cand.cycleBId)
      if (!a || !b) throw new Error(`Overlap-Kandidat unbekannt: ${cand.cycleAId} × ${cand.cycleBId}`)
      const assessment = await withRetry(() => opts.overlapAssessor.assess(a, b))
      done++
      opts.log?.(done, total, `overlap ${assessment.cycleAId} × ${assessment.cycleBId}`)
      return assessment
    }),
  )

  const alignJobs = input.alignmentCandidates.map((cand: { cycleId: string }) =>
    opts.limit(async () => {
      const cycle = input.cyclesById.get(cand.cycleId)
      if (!cycle) throw new Error(`Alignment-Kandidat unbekannt: ${cand.cycleId}`)
      const assessment = await withRetry(() => opts.alignmentAssessor.assess(cycle))
      done++
      opts.log?.(done, total, `alignment ${cycle.id}`)
      return assessment
    }),
  )

  const [overlaps, alignments] = await Promise.all([
    Promise.all(overlapJobs),
    Promise.all(alignJobs),
  ])
  return { overlaps, alignments }
}

const nowISO = () => new Date().toISOString()

function freshResult(id: string): MappingResultBase {
  return {
    id,
    status: 'ai_suggested',
    version: 'v1',
    history: [{ at: nowISO(), by: 'ai', action: 'ai_suggested' }],
  }
}

const PRIORITY_RANK: Record<ReviewPriority, number> = { high: 0, medium: 1, low: 2, none: 3 }

/** Stufe 4: Roh-Assessments aggregieren. */
export function explainCurriculumMap(
  input: MappingInput,
  modules: ModuleCore[],
  raw: { overlaps: OverlapAssessment[]; alignments: AlignmentAssessment[] },
): CurriculumMap {
  const moduleIdOf = new Map([...input.cyclesById.values()].map((c) => [c.id, c.moduleId]))
  const candidatesByPair = new Map(input.overlapCandidates.map((c) => [`${c.cycleAId}||${c.cycleBId}`, c]))

  // ---- Overlap-Entries inkl. Review-Priorität (Kap. 9 Reaktionstabelle)
  const overlapEntries: OverlapEntry[] = raw.overlaps.map((o) => {
    const cand = candidatesByPair.get(`${o.cycleAId}||${o.cycleBId}`)
    const embeddingSimilarity = cand?.embeddingSimilarity ?? 0
    const lexicalSimilarity = cand?.lexicalSimilarity
    const priority = assessReviewPriority({
      relationship: o.relationship,
      llmConfidence: o.confidence,
      embeddingSimilarity,
      lexicalSimilarity,
    })
    return {
      ...freshResult(pairKey(o.cycleAId, o.cycleBId)),
      type: 'overlap',
      moduleAId: moduleIdOf.get(o.cycleAId) ?? o.cycleAId,
      moduleBId: moduleIdOf.get(o.cycleBId) ?? o.cycleBId,
      cycleAId: o.cycleAId,
      cycleBId: o.cycleBId,
      assessment: o,
      embeddingSimilarity,
      lexicalSimilarity,
      reviewPriority: priority,
    }
  })

  // ---- Alignment-Entries
  const alignEntries: AlignmentEntry[] = raw.alignments.map((a) => {
    const cycle = input.cyclesById.get(a.cycleId)
    const cat = a.mismatch ? ALIGNMENT_CATALOG[a.mismatch] : undefined
    return {
      ...freshResult(`al_${a.cycleId}`),
      type: 'alignment',
      cycleId: a.cycleId,
      moduleId: cycle?.moduleId ?? a.cycleId,
      claimedLevel: a.claimedLevel,
      observation: a,
      priority: cat?.reviewPriority ?? 'none',
    }
  })

  // ---- Modul-zu-Modul-Matrix (aggregiert pro Modulpaar; Drill-down über entries)
  const modulePairs = new Map<string, ModulePairSummary>()
  for (const e of overlapEntries) {
    const key = [e.moduleAId, e.moduleBId].sort().join('||')
    const [mA, mB] = key.split('||')
    let summary = modulePairs.get(key)
    if (!summary) {
      summary = {
        moduleAId: mA!,
        moduleBId: mB!,
        topRelationship: e.assessment.relationship,
        maxSimilarity: e.embeddingSimilarity,
        openReviewCount: isOpen(e.status) ? 1 : 0,
        entries: [],
      }
      modulePairs.set(key, summary)
    }
    summary.entries.push(e)
    summary.maxSimilarity = Math.max(summary.maxSimilarity, e.embeddingSimilarity)
    if (isOpen(e.status)) summary.openReviewCount++
    // auffälligste Beziehung = kleinster priority-Rank
    if (PRIORITY_RANK[priorityOf(e.assessment.relationship)] < PRIORITY_RANK[priorityOf(summary.topRelationship)]) {
      summary.topRelationship = e.assessment.relationship
    }
  }

  // ---- Progressionsansicht: I-R-M über Module, Alignment-Hinweis je LC
  const alignByCycle = new Map(raw.alignments.map((a) => [a.cycleId, a]))
  const progression: CurriculumMap['progression'] = []
  for (const cycle of input.cyclesById.values()) {
    if (!cycle.level) continue
    const al = alignByCycle.get(cycle.id)
    let alignmentHint: string | undefined
    if (al && !al.assessmentMatchesLevel && al.mismatch) {
      const cat = ALIGNMENT_CATALOG[al.mismatch]
      alignmentHint = cat ? `${cat.description} — ${al.rationale}` : al.rationale
    }
    progression.push({
      cycleId: cycle.id,
      moduleId: cycle.moduleId,
      level: cycle.level,
      learningGoals: cycle.learningGoals,
      alignmentHint,
    })
  }
  const levelRank: Record<IrmLevel, number> = { I: 0, R: 1, M: 2 }
  progression.sort((a, b) => levelRank[a.level] - levelRank[b.level] || a.moduleId.localeCompare(b.moduleId))

  // ---- Coverage Map: Cluster der Learning Goals als "Kompetenz"-Rows (MVP:
  // gemeinsame Keyword-Basis reicht; echte Kompetenz-Verknüpfung folgt vom
  // Taxonomy-Import). Je Cluster: welche Module führen/verstärken/vertiefen
  // inkl Alignment-Befund derselben LCs.
  const coverage = buildCoverage([...input.cyclesById.values()], alignByCycle)

  void modules
  return {
    program: input.program,
    generatedAt: nowISO(),
    version: 'v1',
    moduleMatrix: [...modulePairs.values()],
    progression,
    coverage,
    openReview: {
      overlaps: overlapEntries.filter((e) => isOpen(e.status)),
      alignments: alignEntries.filter((e) => isOpen(e.status)),
    },
  }
}

function isOpen(s: ReviewStatus): boolean {
  return s === 'ai_suggested' || s === 'pending_review'
}

function priorityOf(relationship: string): ReviewPriority {
  const cat = (RELATIONSHIP_CATALOG as Record<string, { reviewPriority: ReviewPriority }>)[relationship]
  return cat?.reviewPriority ?? 'none'
}

/**
 * Coverage-Heuristik (MVP, Kap. 8): Learning Goals werden über gemeinsame
 * Keyword-Bags zu Themen-Containers geclustert (greedy: gemeinsames Keyword
 * = gleiche Kompetenz-Zeile). Alignment-Befunde desselben LCs wandern in
 * die Spalte alignmentIssues.
 */
export function buildCoverage(
  cycles: LearningCycle[],
  alignByCycle: Map<string, AlignmentAssessment>,
): CoverageCol[] {
  const cols = new Map<string, CoverageCol>()

  for (const cycle of cycles) {
    // Themes aus Learning-Goal-Bullets (angereichert mit Inhalten) ableiten
    // Pro LC: Term-Bullets sind einzeln nicht statisch zuordenbar -> wir
    // clustern über das einfachste Merkmal: erste bedeutende Termphrase.
    const key = coverageKey(cycle.learningGoals)

    let col = cols.get(key)
    if (!col) {
      col = { competency: headOfGoals(cycle.learningGoals), introduce: [], reinforce: [], master: [], alignmentIssues: [] }
      cols.set(key, col)
    }
    const mod = cycle.moduleId
    const bucketList = levelBucket(cycle, col)
    if (!bucketList.includes(mod)) bucketList.push(mod)

    const al = alignByCycle.get(cycle.id)
    if (al && !al.assessmentMatchesLevel && al.mismatch) {
      col.alignmentIssues.push({ cycleId: cycle.id, issue: al.mismatch })
    }
  }

  return [...cols.values()].sort((a, b) => a.competency.localeCompare(b.competency))
}

function levelBucket(cycle: LearningCycle, col: CoverageCol): string[] {
  switch (cycle.level) {
    case 'I':
      return col.introduce
    case 'R':
      return col.reinforce
    case 'M':
      return col.master
    default:
      return col.reinforce
  }
}

/** kleinstmöglicher Topics-Cluster: gemeinsame Nomen aus Learning Goals */
function coverageKey(goals: string): string {
  return tokenizeForCoverage(goals).slice(0, 2).join('_') || 'Allgemein'
}

function headOfGoals(goals: string): string {
  const first = goals.split('\n')[0] ?? goals
  return first.slice(0, 60) + (first.length > 60 ? '…' : '')
}

const COVERAGE_STOPWORDS = new Set([
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einer', 'und', 'oder', 'in', 'im', 'zur', 'zum', 'für', 'mit',
  'können', 'verstehe', 'verstehen', 'studierende', 'studierenden', 'auf', 'durch', 'als', 'sich', 'und', 'oder',
  'the', 'and', 'for', 'students', 'their', 'from', 'with', 'into', 'that',
])

function tokenizeForCoverage(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-zäöü0-9]+/)
    .filter((t) => t.length > 3 && !COVERAGE_STOPWORDS.has(t))
}

function coverageBucketFor(goals: string): string[] {
  return tokenizeForCoverage(goals)
}
