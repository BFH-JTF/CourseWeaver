/**
 * Orchestrierung der vier Stufen (Kap. 2) — Batch-Pipeline analog Solver.
 * Der HTTP-Handler (routes/mapping.ts) ruft nur `findCandidates(...)` und
 * `analyze(...)`; alles fachliche steckt in den Stufen-Modulen
 * (domain/mappingInput/assessors/explain).
 */
import { createHash } from 'node:crypto'
import type { LearningCycle, MappingConfig, MappingInput, ModuleCore } from './domain.js'
import { buildMappingInput, cycleText, lexicalSimilarityMap } from './mappingInput.js'
import type {
  AlignmentAssessor,
  EmbeddingProvider,
  OverlapAssessor,
  ProgressLog,
} from './assessors.js'
import {
  createConcurrencyLimiter,
  createHeuristicAlignmentAssessor,
  createHeuristicOverlapAssessor,
} from './assessors.js'
import { explainCurriculumMap, runAssessors, type CurriculumMap } from './explain.js'
import { getCachedCycleEmbeddings, saveCycleEmbedding } from '../db.js'

export function isOllamaConfigured(): boolean {
  return Boolean(process.env.MAPPING_OLLAMA_HOST)
}

export interface AnalyzeOptions {
  program?: string
  threshold?: number
  topK?: number
  /** Paare aus demselben Modul einschliessen (Kap. 2.1 Schritt 6); Default: ausschliessen */
  includeSameModule?: boolean
  /** max. gleichzeitige LLM-/Embedding-Calls (Kap. 7), Default 5 */
  maxConcurrent?: number
  log?: ProgressLog
  /** vorberechnet aus findCandidates() — überspringt Embedding + Kandidaten-Bau */
  input?: MappingInput
}

function configFrom(opts: AnalyzeOptions): Partial<MappingConfig> {
  const config: Partial<MappingConfig> = {}
  if (opts.threshold !== undefined) config.threshold = opts.threshold
  if (opts.topK !== undefined) config.topK = opts.topK
  if (opts.includeSameModule !== undefined) config.includeSameModule = opts.includeSameModule
  return config
}

/** SHA-256 des LC-Texts — erkennt geänderte Texte im Embedding-Cache (Kap. 6). */
export function cycleTextHash(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

export interface CandidateBuildResult {
  input: MappingInput
  mode: 'embedding' | 'lexical'
  embeddingStats: {
    total: number
    cached: number
    computed: number
    modelId: string | null
  }
}

/**
 * Kap. 2.1 — "Kandidaten finden" (Stufe 2, günstig: keine LLM-Aufrufe):
 *  1. Text pro LC zusammensetzen (cycleText),
 *  2. embedden — mit pgvector-Cache, nie neu berechnen, wenn der Text
 *     unverändert ist (text_hash),
 *  3-6. buildMappingInput: Cosinus-Ähnlichkeit, topK + Schwellenwert,
 *     Dedupe, Same-Module-Paare ausgeschlossen.
 */
export async function findCandidates(
  cycles: LearningCycle[],
  opts: AnalyzeOptions & { embeddingProvider?: EmbeddingProvider } = {},
): Promise<CandidateBuildResult> {
  if (cycles.length === 0) throw new Error('findCandidates: cycles leer')

  let embeddings: Map<string, number[]> | undefined
  let mode: 'embedding' | 'lexical' = 'lexical'
  const stats = { total: 0, cached: 0, computed: 0, modelId: null as string | null }

  if (opts.embeddingProvider) {
    mode = 'embedding'
    const modelId = opts.embeddingProvider.modelId ?? 'unknown'
    const texts = cycles.map((c) => cycleText(c))
    const hashes = texts.map(cycleTextHash)

    // Schritt 2: Cache lesen (Kap. 6) — im Degraded-Modus (kein pg) neu berechnen
    const vectorsById = new Map<string, number[]>()
    try {
      const cached = await getCachedCycleEmbeddings(cycles.map((c) => c.id), modelId)
      cycles.forEach((c, i) => {
        const row = cached.get(c.id)
        if (row && row.textHash === hashes[i] && row.embedding.length > 0) {
          vectorsById.set(c.id, row.embedding)
        }
      })
    } catch {
      // Degraded-Modus: In-Memory-Fallback ohne Vektor-Persistenz
    }
    stats.cached = vectorsById.size

    const missing = cycles.filter((c) => !vectorsById.has(c.id))
    if (missing.length > 0) {
      const vectors = await opts.embeddingProvider.embed(missing.map((c) => cycleText(c)))
      missing.forEach((c, i) => {
        vectorsById.set(c.id, vectors[i]!)
        // Cache füllen; Fehler (z. B. kein pg) dürfen die Kandidaten-Suche nicht blockieren
        saveCycleEmbedding(c.id, vectors[i]!, modelId, cycleTextHash(cycleText(c))).catch(() => {})
      })
    }
    stats.computed = missing.length
    stats.total = cycles.length
    stats.modelId = modelId
    embeddings = vectorsById
  }

  const input = buildMappingInput(cycles, {
    program: opts.program,
    embeddings,
    config: configFrom(opts),
  })
  return { input, mode, embeddingStats: stats }
}

/** Standard (Offline/Tests): Heuristik mit lexikalischem Fallback statt LLM. */
export async function analyzeWithHeuristics(
  cycles: LearningCycle[],
  modules: ModuleCore[],
  opts: AnalyzeOptions = {},
): Promise<CurriculumMap> {
  const input =
    opts.input ??
    buildMappingInput(cycles, { program: opts.program, config: configFrom(opts) })
  const raw = await runAssessorsSync(input, {
    overlap: createHeuristicOverlapAssessor(lexicalSimilarityMap(cycles)),
    alignment: createHeuristicAlignmentAssessor(),
  })
  return explainCurriculumMap(input, modules, raw)
}

/**
 * LLM/Embedding-Modus (Kap. 3): Ollama lokal oder andere austauschbare Provider.
 * Mit opts.input (aus findCandidates) werden die Kandidaten wiederverwendet —
 * Stufe 2 läuft dann nicht doppelt (Frontend-Flow: erst Kandidaten zeigen,
 * dann bewerten).
 */
export async function analyze(
  cycles: LearningCycle[],
  modules: ModuleCore[],
  opts: AnalyzeOptions & {
    embeddingProvider?: EmbeddingProvider
    overlapAssessor?: OverlapAssessor
    alignmentAssessor?: AlignmentAssessor
  } = {},
): Promise<CurriculumMap> {
  let input: MappingInput
  if (opts.input) {
    input = opts.input
  } else {
    const built = await findCandidates(cycles, opts)
    input = built.input
  }

  const limit = createConcurrencyLimiter(opts.maxConcurrent ?? 5)
  const overlapAssessor = opts.overlapAssessor ?? createHeuristicOverlapAssessor(lexicalSimilarityMap(cycles))
  const alignmentAssessor = opts.alignmentAssessor ?? createHeuristicAlignmentAssessor()

  const raw = await runAssessors(input, {
    limit,
    overlapAssessor,
    alignmentAssessor,
    log: opts.log,
  })
  return explainCurriculumMap(input, modules, raw)
}

/** Awaitbarer Wrapper für die reine Heuristik (kein Concurrency-Limit nötig). */
async function runAssessorsSync(
  input: MappingInput,
  assessors: { overlap: OverlapAssessor; alignment: AlignmentAssessor },
): Promise<{ overlaps: Awaited<ReturnType<OverlapAssessor['assess']>>[]; alignments: Awaited<ReturnType<AlignmentAssessor['assess']>>[] }> {
  const overlapPromises = input.overlapCandidates.map((cand) => {
    const a = input.cyclesById.get(cand.cycleAId)
    const b = input.cyclesById.get(cand.cycleBId)
    if (!a || !b) throw new Error(`Overlap-Kandidat unbekannt: ${cand.cycleAId} × ${cand.cycleBId}`)
    return assessors.overlap.assess(a, b)
  })
  const alignmentPromises = input.alignmentCandidates.map((c) => {
    const cycle = input.cyclesById.get(c.cycleId)
    if (!cycle) throw new Error(`Alignment-Kandidat unbekannt: ${c.cycleId}`)
    return assessors.alignment.assess(cycle)
  })
  return {
    overlaps: await Promise.all(overlapPromises),
    alignments: await Promise.all(alignmentPromises),
  }
}
