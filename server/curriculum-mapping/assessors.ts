/**
 * Kap. 3 — Austauschbare Bewerter (Solver-Interface-Muster):
 * Anwendungscode kennt nie die konkrete Bibliothek, nur die Interfaces hier.
 * Implementierungen:
 *   - OllamaEmbeddingProvider / OllamaOverlapAssessor / OllamaAlignmentAssessor (LLM lokal)
 *   - Heuristik-Fallbacks (deterministisch, Tests/Offline)
 * Kap. 7 — Concurrency-Limiter (I/O-lastige Calls) statt Worker-Thread:
 * max. N gleichzeitige LLM-/Embedding-Requests, Retry mit Backoff, Fortschritts-
 * Log, da hunderte Kandidatenpaare mehrere Minuten laufen können.
 */

import type { LearningCycle, IrmLevel } from './domain.js'
import type { AlignmentIssueId, RelationshipId } from './catalog.js'
import { RELATIONSHIP_CATALOG } from './catalog.js'

// ---------------------------------------------------------------------------
// Typen Stufe 3 (roh)
// ---------------------------------------------------------------------------

export interface OverlapAssessment {
  cycleAId: string
  cycleBId: string
  relationship: RelationshipId
  /** gerichtet: wie stark A in B aufgeht bzw. umgekehrt (0-1); I-R-M trennt Progression von Duplikation (Kap. 5) */
  overlapA: number
  overlapB: number
  sharedConcepts: string[]
  differences: string[]
  irmA?: IrmLevel
  irmB?: IrmLevel
  isProgression?: boolean
  rationale: string
  confidence: number // 0-1
}

export type ObservedCognitiveLevel =
  | 'recall'
  | 'application'
  | 'analysis'
  | 'evaluation'
  | 'creation'

export interface AlignmentAssessment {
  cycleId: string
  claimedLevel: IrmLevel
  observedCognitiveLevel: ObservedCognitiveLevel
  assessmentMatchesLevel: boolean
  mismatch?: AlignmentIssueId
  rationale: string
  confidence: number
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>
  /** Modell-Id als Cache-Schlüssel in learning_cycle_embeddings (Kap. 6), falls vorhanden */
  readonly modelId?: string
}

export interface OverlapAssessor {
  assess(a: LearningCycle, b: LearningCycle): Promise<OverlapAssessment>
}

export interface AlignmentAssessor {
  assess(cycle: LearningCycle): Promise<AlignmentAssessment>
}

// ---------------------------------------------------------------------------
// Kap. 7 — Concurrency-Limiter (I/O-lastig: max. N gleichzeitige Calls)
// ---------------------------------------------------------------------------

export type LimitFn = <T>(fn: () => Promise<T>) => Promise<T>

export function createConcurrencyLimiter(maxConcurrent: number): LimitFn {
  if (maxConcurrent < 1) throw new Error('maxConcurrent >= 1 erforderlich')
  let active = 0
  let queued = 0
  const waiters: Array<() => void> = []
  const tick = () => {
    while (queued > 0 && active < maxConcurrent) {
      const w = waiters.shift()!
      queued--
      active++
      w()
    }
  }
  return async function limit<T>(fn: () => Promise<T>): Promise<T> {
    if (active < maxConcurrent) {
      active++
    } else {
      await new Promise<void>((resolve) => {
        waiters.push(resolve)
        queued++
        void 0
      })
    }
    try {
      return await fn()
    } finally {
      active--
      void Promise.resolve().then(tick)
    }
  }
}

/** Kap. 7 — Retry mit exponentiellem Backoff (Rate-Limits, Netzwerkprobleme). */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; baseDelayMs?: number; onRetry?: (attempt: number, err: Error) => void } = {},
): Promise<T> {
  const retries = opts.retries ?? 2
  let lastErr: Error | null = null
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err: any) {
      lastErr = err
      if (attempt === retries) break
      const delay = (opts.baseDelayMs ?? 500) * Math.pow(2, attempt)
      opts.onRetry?.(attempt, err)
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw lastErr ?? new Error('withRetry: alle Versuche fehlgeschlagen')
}

/** Fortschritts-Log für lange Batches (Kap. 7). */
export interface ProgressLog {
  (done: number, total: number, label: string): void
}

// ---------------------------------------------------------------------------
// Ollama-Implementierungen — lokal, Inhalte verlassen die Infrastruktur nicht
// ---------------------------------------------------------------------------

export interface OllamaOptions {
  host: string // z.B. http://localhost:11434
  embeddingModel?: string // z.B. 'nomic-embed-text', 'paraphrase-multilingual' (mehrsprachig wählen)
  llmModel?: string // z.B. 'llama3.1'
  fetchImpl?: typeof fetch
}

export class OllamaEmbeddingProvider implements EmbeddingProvider {
  readonly modelId: string
  constructor(private readonly opts: OllamaOptions) {
    this.modelId = opts.embeddingModel ?? 'nomic-embed-text'
  }

  embeddingModelId(): string {
    return this.modelId
  }

  async embed(texts: string[]): Promise<number[][]> {
    const fetchImpl = this.opts.fetchImpl ?? fetch
    const out: number[][] = []
    for (const text of texts) {
      const res = await withRetry(async () =>
        fetchImpl(`${this.opts.host}/api/embeddings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: this.opts.embeddingModel ?? 'nomic-embed-text', prompt: text }),
        }),
      )
      if (!res.ok) throw new Error(`Ollama embeddings HTTP ${res.status}`)
      const json = (await res.json()) as { embedding: number[] }
      out.push(json.embedding)
    }
    return out
  }
}

const OVERLAP_PROMPT = (a: LearningCycle, b: LearningCycle) => `\
Du bist Experte fuer Curriculum-Design an einer Hochschule.
Vergleiche die zwei Learning Cycles desselben Masterprogramms und beurteile,
ob sie sich inhaltlich überschneiden — und ob das Redundanz oder gerichtete
Progression (I-R-M) ist.

LC A (${a.moduleId}, ${a.structuralElement}, Niveau ${a.level ?? '-'}, Assignment ${a.assignmentType ?? '-'}):
Lernziele: ${a.learningGoals}
Inhalte: ${a.mainContent}
Didaktik: ${a.didactics}
Assessment: ${a.assignmentDescription ?? '-'}

LC B (${b.moduleId}, ${b.structuralElement}, Niveau ${b.level ?? '-'}, Assignment ${b.assignmentType ?? '-'}):
Lernziele: ${b.learningGoals}
Inhalte: ${b.mainContent}
Didaktik: ${b.didactics}
Assessment: ${b.assignmentDescription ?? '-'}

Antworte NUR mit folgendem JSON, ohne weitere Texte:
{"relationship":"DUPLICATE|SUBSTANTIAL_OVERLAP|PARTIAL_OVERLAP|PROGRESSION|COMPLEMENTARY|SAME_TOPIC_DIFFERENT_FOCUS|NO_MEANINGFUL_OVERLAP",
 "overlapA":0,"overlapB":0,"sharedConcepts":[],"differences":[],
 "isProgression":false,"rationale":"1-2 Saetze","confidence":0.5}`

const ALIGNMENT_PROMPT = (c: LearningCycle) => `\
Du bist Experte fuer Constructive Alignment (AACSB Assurance of Learning).
Beurteile diesen EINZELNEN Learning Cycle: Passt die Pruefungsform zum
beanspruchten Niveau (I=Introduce, R=Reinforce, M=Master)?

Lernziele: ${c.learningGoals}
Inhalte: ${c.mainContent}
Didaktik: ${c.didactics}
Assessment: ${c.assignmentDescription ?? '-'} (Typ: ${c.assignmentType ?? 'unbekannt'}, Gewicht ${c.gradingPercentage != null ? c.gradingPercentage * 100 + '%' : '-'})
Beanspruchtes Niveau: ${c.level}

Antworte NUR mit folgendem JSON, ohne weitere Texte:
{"observedCognitiveLevel":"recall","assessmentMatchesLevel":false,"mismatch":"ASSESSMENT_TOO_SHALLOW","rationale":"1-2 Saetze auf Deutsch","confidence":0.5}`

function parseJsonLoose<T>(text: string): T {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('LLM-Antwort ohne JSON: ' + text.slice(0, 120))
  return JSON.parse(text.slice(start, end + 1)) as T
}

/**
 * Kap. 4 — LLM-Antworten driften vom Katalog ("ASSESSMENT_TOO_DEEP",
 * "TOO_DEMANDING"), müssen aber stabile AlignmentIssue-Ids liefern, die
 * Backend und Frontend gemeinsam nutzen. Unbekannte Antworten → undefined
 * (kein Befund) statt eines Farben-losen Fake-Ids.
 */
export function normalizeMismatch(mismatch: unknown): AlignmentIssueId | undefined {
  if (typeof mismatch !== 'string' || mismatch.trim() === '' || mismatch === 'null') return undefined
  const s = mismatch.toUpperCase().replace(/[\s-]+/g, '_')
  if (s === 'ASSESSMENT_TOO_SHALLOW') return 'ASSESSMENT_TOO_SHALLOW'
  if (s === 'ASSESSMENT_TOO_DEMANDING') return 'ASSESSMENT_TOO_DEMANDING'
  if (s === 'NO_ASSESSMENT_PRESENT') return 'NO_ASSESSMENT_PRESENT'
  if (s.includes('SHALLOW') || s.includes('SWALLOW')) return 'ASSESSMENT_TOO_SHALLOW'
  if (s.includes('DEEP') || s.includes('DEMANDING')) return 'ASSESSMENT_TOO_DEMANDING'
  if (s.includes('NO') && s.includes('ASSESS')) return 'NO_ASSESSMENT_PRESENT'
  return undefined
}

/**
 * Kap. 4 — Gleiches Prinzip für Overlap-Beziehungen: LLM-Antwort normalisieren
 * auf eine stabile RelationshipId; unbekannt → NO_MEANINGFUL_OVERLAP.
 */
export function normalizeRelationship(relationship: unknown): RelationshipId {
  if (typeof relationship !== 'string') return 'NO_MEANINGFUL_OVERLAP'
  const s = relationship.toUpperCase().replace(/[\s-]+/g, '_')
  const known: RelationshipId[] = [
    'DUPLICATE',
    'SUBSTANTIAL_OVERLAP',
    'PARTIAL_OVERLAP',
    'PROGRESSION',
    'COMPLEMENTARY',
    'SAME_TOPIC_DIFFERENT_FOCUS',
    'NO_MEANINGFUL_OVERLAP',
  ]
  if ((known as string[]).includes(s)) return s as RelationshipId
  if (s.includes('DUPLICAT') || s.includes('SAME_LEVEL')) return 'DUPLICATE'
  if (s.includes('SUBSTANTIAL')) return 'SUBSTANTIAL_OVERLAP'
  if (s.includes('PARTIAL')) return 'PARTIAL_OVERLAP'
  if (s.includes('PROGRESS')) return 'PROGRESSION'
  if (s.includes('COMPLEMENT')) return 'COMPLEMENTARY'
  if (s.includes('FOCUS') || s.includes('DIFFERENT')) return 'SAME_TOPIC_DIFFERENT_FOCUS'
  return 'NO_MEANINGFUL_OVERLAP'
}

function ollamaChat(opts: OllamaOptions, prompt: string): Promise<string> {
  const fetchImpl = opts.fetchImpl ?? fetch
  return withRetry(async () => {
    const res = await fetchImpl(`${opts.host}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: opts.llmModel ?? 'llama3.1',
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        format: 'json',
      }),
    })
    if (!res.ok) throw new Error(`Ollama chat HTTP ${res.status}`)
    const json = (await res.json()) as { message?: { content?: string } }
    return json.message?.content ?? ''
  })
}

export class OllamaOverlapAssessor implements OverlapAssessor {
  constructor(private readonly opts: OllamaOptions) {}

  async assess(a: LearningCycle, b: LearningCycle): Promise<OverlapAssessment> {
    const content = await ollamaChat(this.opts, OVERLAP_PROMPT(a, b))
    const parsed = parseJsonLoose<{
      relationship?: string
      overlapA?: number
      overlapB?: number
      sharedConcepts?: string[]
      differences?: string[]
      isProgression?: boolean
      rationale?: string
      confidence?: number
    }>(content)
    return {
      cycleAId: a.id,
      cycleBId: b.id,
      relationship: normalizeRelationship(parsed.relationship),
      overlapA: parsed.overlapA ?? 0,
      overlapB: parsed.overlapB ?? 0,
      sharedConcepts: parsed.sharedConcepts ?? [],
      differences: parsed.differences ?? [],
      irmA: a.level,
      irmB: b.level,
      isProgression: parsed.isProgression,
      rationale: parsed.rationale ?? '',
      confidence: parsed.confidence ?? 0.5,
    }
  }
}

export class OllamaAlignmentAssessor implements AlignmentAssessor {
  constructor(private readonly opts: OllamaOptions) {}

  async assess(cycle: LearningCycle): Promise<AlignmentAssessment> {
    const content = await ollamaChat(this.opts, ALIGNMENT_PROMPT(cycle))
    const parsed = parseJsonLoose<{
      observedCognitiveLevel?: string
      assessmentMatchesLevel?: boolean
      mismatch?: string | null
      rationale?: string
      confidence?: number
    }>(content)
    return {
      cycleId: cycle.id,
      claimedLevel: cycle.level!,
      observedCognitiveLevel: (parsed.observedCognitiveLevel ?? 'recall') as ObservedCognitiveLevel,
      assessmentMatchesLevel: parsed.assessmentMatchesLevel ?? true,
      mismatch: normalizeMismatch(parsed.mismatch),
      rationale: parsed.rationale ?? '',
      confidence: parsed.confidence ?? 0.5,
    }
  }
}

// ---------------------------------------------------------------------------
// Deterministische Heuristik-Fallbacks (Tests/Offline — dokumentierte Regeln)
// ---------------------------------------------------------------------------

const LEVEL_RANK: Record<IrmLevel, number> = { I: 0, R: 1, M: 2 }
const LEVEL_TO_COGNITIVE: Record<IrmLevel, ObservedCognitiveLevel> = {
  I: 'recall',
  R: 'application',
  M: 'creation',
}

export function pairKey(aId: string, bId: string): string {
  return [aId, bId].sort().join('::')
}

export interface HeuristicThresholds {
  /** >= => Substantial/Duplicate-Territorium */
  strongOverlap: number
  mediumOverlap: number
}

export function createHeuristicOverlapAssessor(
  lexicalByPair: Map<string, number>,
  thresholds: HeuristicThresholds = { strongOverlap: 0.6, mediumOverlap: 0.35 },
): OverlapAssessor {
  return {
    async assess(a: LearningCycle, b: LearningCycle): Promise<OverlapAssessment> {
      const sim = lexicalByPair.get(pairKey(a.id, b.id)) ?? 0
      const isProgression =
        a.level !== undefined && b.level !== undefined && LEVEL_RANK[b.level] > LEVEL_RANK[a.level]

      let relationship: RelationshipId
      if (sim >= thresholds.strongOverlap) {
        // gleicher Inhalt + gleiches Niveau -> Redundanz; steigendes Niveau -> Vertiefung
        relationship = isProgression ? 'PROGRESSION' : 'DUPLICATE'
      } else if (sim >= thresholds.mediumOverlap) {
        relationship = isProgression ? 'PROGRESSION' : 'PARTIAL_OVERLAP'
      } else {
        relationship = 'NO_MEANINGFUL_OVERLAP'
      }

      const clamp = (v: number) => Math.min(1, Math.max(0, v))
      return {
        cycleAId: a.id,
        cycleBId: b.id,
        relationship,
        overlapA: clamp(sim),
        overlapB: clamp(sim),
        sharedConcepts: [],
        differences: [],
        irmA: a.level,
        irmB: b.level,
        isProgression,
        rationale:
          `Heuristik: lexikalische Ähnlichkeit ${sim.toFixed(2)}` + (isProgression ? ' — steigendes I-R-M-Niveau' : ''),
        confidence: sim >= thresholds.strongOverlap ? 0.7 : 0.5,
      }
    },
  }
}

export function createHeuristicAlignmentAssessor(): AlignmentAssessor {
  return {
    async assess(cycle: LearningCycle): Promise<AlignmentAssessment> {
      const level = cycle.level!
      const type = cycle.assignmentType ?? 'Non-graded'

      let observed: ObservedCognitiveLevel = LEVEL_TO_COGNITIVE[level]
      let matches = true
      let mismatch: AlignmentIssueId | undefined

      if (type === 'Non-graded') {
        // kein benotetes/verrechnetes Instrument -> Alignment nicht belegbar
        observed = 'recall'
        matches = false
        mismatch = 'NO_ASSESSMENT_PRESENT'
      } else if (type === 'Pass/Fail' && level === 'M') {
        // Master-Niveau mit unbenotetem Reading-Quiz-Äquivalent -> zu flach
        observed = 'application'
        matches = false
        mismatch = 'ASSESSMENT_TOO_SHALLOW'
      } else if (type === 'Graded' && level === 'I') {
        observed = 'application'
        matches = false
        mismatch = 'ASSESSMENT_TOO_DEMANDING'
      } else {
        observed = LEVEL_TO_COGNITIVE[level]
        matches = true
        mismatch = undefined
      }

      return {
        cycleId: cycle.id,
        claimedLevel: level,
        observedCognitiveLevel: observed,
        assessmentMatchesLevel: matches,
        mismatch,
        rationale: `Heuristik: Assignment ${type} auf Level ${level}${mismatch ? ' -> ' + mismatch : ''}`,
        confidence: 0.6,
      }
    },
  }
}

// ---------------------------------------------------------------------------
// Kap. 9 — Reaktionstabelle (hohe/mittlere/niedrige Sicherheit, Widerspruch
// Embedding↔LLM/lexical: eine Prioritätsstufe hoch zur manuellen Prüfung)
// ---------------------------------------------------------------------------

export function assessReviewPriority(ops: {
  relationship: RelationshipId
  llmConfidence: number
  embeddingSimilarity: number
  lexicalSimilarity?: number
}): ReviewPriority {
  let priority: ReviewPriority = RELATIONSHIP_CATALOG[ops.relationship]?.reviewPriority ?? 'none'
  if (ops.llmConfidence < 0.5) priority = bump(priority)
  if (ops.lexicalSimilarity !== undefined && Math.abs(ops.embeddingSimilarity - ops.lexicalSimilarity) > 0.4) {
    priority = bump(priority)
  }
  return priority
}

export type ReviewPriority = 'high' | 'medium' | 'low' | 'none'

function bump(p: ReviewPriority): ReviewPriority {
  switch (p) {
    case 'none':
      return 'low'
    case 'low':
      return 'medium'
    case 'medium':
      return 'high'
    case 'high':
      return p
  }
}

/** Review-Entscheidung (Kap. 9) — versioniert + Audit Trail via db entity_store */
export interface MappingReviewDecision {
  assessmentKey: string // `${a}||${b}` für Overlap, `align||${cycleId}` für Alignment
  decision: 'confirmed' | 'rejected'
  decidedBy: string
  decidedAt: string // ISO
  note?: string
}
