/**
 * Kap. 10 MVP-Routen für Curriculum Mapping:
 *   GET  /api/mapping/catalog        — Relationship/Alignment-Kataloge (Farblogik gemeinsam)
 *   POST /api/mapping/candidates     — Stufe 2 "Kandidaten finden" (günstig: Embeddings, keine LLM-Calls)
 *   POST /api/mapping/analyze        — Stufen 2-4 batch (heuristisch oder via MAPPING_OLLAMA_HOST LLM);
 *                                      akzeptiert vorberechnete candidates aus /candidates
 *   POST /api/mapping/cycles         — LearningCycles persistieren (entity_store, Tabelle learning_cycles)
 *   GET  /api/mapping/cycles         — persistierte LearningCycles laden
 *   POST /api/mapping/review         — Review-Entscheidung (Audit Trail via kredit? nein: entity_store 'mapping_reviews')
 */
import { Router, Request, Response } from 'express'
import { getAllEntities, saveEntity, findTopKSimilar, saveCycleEmbedding } from '../db.js'
import { analyze, analyzeWithHeuristics, cycleTextHash, findCandidates, isOllamaConfigured } from '../curriculum-mapping/pipeline.js'
import type { LearningCycle, MappingInput, ModuleCore } from '../curriculum-mapping/domain.js'
import { RELATIONSHIP_CATALOG, ALIGNMENT_CATALOG } from '../curriculum-mapping/catalog.js'
import { createConcurrencyLimiter, OllamaEmbeddingProvider } from '../curriculum-mapping/assessors.js'
import { cycleText, defaultMappingConfig } from '../curriculum-mapping/mappingInput.js'
import { OllamaOverlapAssessor, OllamaAlignmentAssessor } from '../curriculum-mapping/assessors.js'

export const mappingRouter = Router()

/** GET /api/mapping/catalog — Frontend nutzt dieselbe Quelle (Kap. 4). */
mappingRouter.get('/catalog', (_req, res) => {
  res.json({
    relationships: Object.values(RELATIONSHIP_CATALOG),
    alignmentIssues: Object.values(ALIGNMENT_CATALOG),
    configured: { ollama: isOllamaConfigured(), ollamaHost: process.env.MAPPING_OLLAMA_HOST ?? null },
  })
})

/** POST /api/mapping/cycles — LCs speichern (folge-Import via Excel-Import modul). */
mappingRouter.post('/cycles', async (req, res) => {
  try {
    const cycles = (req.body?.cycles ?? []) as LearningCycle[]
    if (!Array.isArray(cycles) || cycles.length === 0) {
      res.status(400).json({ error: 'cycles[] erforderlich' })
      return
    }
    for (const c of cycles) {
      if (!c.id || !c.moduleId || !c.learningGoals || !c.mainContent) {
        res.status(400).json({ error: `LearningCycle unvollständig: ${c.id ?? '(ohne id)'}` })
        return
      }
    }
    let saved = 0
    for (const c of cycles) {
      await saveEntity('learning_cycles', c.id, c)
      saved++
    }
    res.json({ saved })
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Speichern fehlgeschlagen' })
  }
})

mappingRouter.get('/cycles', async (_req, res) => {
  try {
    res.json(await getAllEntities('learning_cycles'))
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Laden fehlgeschlagen' })
  }
})

/**
 * POST /api/mapping/candidates — Stufe 2 "Kandidaten finden" (Kap. 2.1):
 * günstig (nur Embeddings bzw. lexikalisch, KEINE LLM-Aufrufe) auf eine kleine
 * Menge plausibler Kandidatenpaare vorfiltern: topK pro LC + Mindest-Schwellenwert,
 * Dedupe A-B/B-A, Paare aus demselben Modul standardmässig ausgeschlossen.
 * Body: { cycles: LearningCycle[], program?, threshold?, topK?, includeSameModule? }
 */
mappingRouter.post('/candidates', async (req, res) => {
  try {
    const { cycles, threshold, topK, includeSameModule } = req.body as {
      cycles?: LearningCycle[]
      threshold?: number
      topK?: number
      includeSameModule?: boolean
    }
    if (!Array.isArray(cycles) || cycles.length === 0) {
      res.status(400).json({ error: 'cycles[] erforderlich' })
      return
    }
    const host = process.env.MAPPING_OLLAMA_HOST
    const result = await findCandidates(cycles, {
      program: req.body?.program ?? 'default',
      threshold,
      topK,
      includeSameModule,
      embeddingProvider: host
        ? new OllamaEmbeddingProvider({ host, embeddingModel: process.env.MAPPING_EMBEDDING_MODEL })
        : undefined,
    })
    res.json({
      candidateCount: result.input.overlapCandidates.length,
      alignmentCandidateCount: result.input.alignmentCandidates.length,
      overlapCandidates: result.input.overlapCandidates,
      alignmentCandidates: result.input.alignmentCandidates,
      mode: result.mode,
      embeddingStats: result.embeddingStats,
    })
  } catch (err: any) {
    console.error('[mapping/candidates] error', err)
    res.status(500).json({ error: err.message || 'Kandidaten-Suche fehlgeschlagen' })
  }
})

/**
 * POST /api/mapping/analyze
 * Body: { cycles: LearningCycle[], modules?: ModuleCore[], threshold?, topK?,
 *         maxConcurrent?, candidates?: { overlapCandidates, alignmentCandidates } }
 * Modus: heuristisch; mit MAPPING_OLLAMA_HOST → Ollama-Embeddings + LLM (Kap. 3/7).
 * Mit candidates (aus POST /candidates) startet direkt Stufe 3 — Stufe 2 läuft
 * nicht doppelt; der Button-Flow zeigt die Kandidatenzahl, bevor die teure
 * LLM-Bewertung beginnt (Kap. 2.1).
 */
mappingRouter.post('/analyze', async (req, res) => {
  try {
    const { cycles, modules, threshold, topK, maxConcurrent, includeSameModule, candidates } = req.body as {
      cycles?: LearningCycle[]
      modules?: ModuleCore[]
      threshold?: number
      topK?: number
      maxConcurrent?: number
      includeSameModule?: boolean
      candidates?: {
        overlapCandidates: MappingInput['overlapCandidates']
        alignmentCandidates: MappingInput['alignmentCandidates']
      }
    }
    if (!Array.isArray(cycles) || cycles.length === 0) {
      res.status(400).json({ error: 'cycles[] erforderlich' })
      return
    }
    const program = req.body?.program ?? 'default'
    const opts = {
      program,
      threshold,
      topK,
      includeSameModule,
      maxConcurrent: maxConcurrent ?? 5,
    }

    // Vorberechnete Stufe 2 übernehmen, falls mitgeliefert (kein Doppel-Embedding)
    const input: MappingInput | undefined = candidates
      ? {
          overlapCandidates: candidates.overlapCandidates ?? [],
          alignmentCandidates: candidates.alignmentCandidates ?? [],
          cyclesById: new Map(cycles.map((c) => [c.id, c])),
          program,
        }
      : undefined

    if (isOllamaConfigured()) {
      const host = process.env.MAPPING_OLLAMA_HOST!
      const map = await analyze(cycles, modules ?? [], {
        ...opts,
        input,
        embeddingProvider: new OllamaEmbeddingProvider({ host, embeddingModel: process.env.MAPPING_EMBEDDING_MODEL }),
        overlapAssessor: new OllamaOverlapAssessor({ host, llmModel: process.env.MAPPING_LLM_MODEL, embeddingModel: process.env.MAPPING_EMBEDDING_MODEL }),
        alignmentAssessor: new OllamaAlignmentAssessor({ host, llmModel: process.env.MAPPING_LLM_MODEL }),
      })
      res.json(map)
      return
    }

    res.json(await analyzeWithHeuristics(cycles, modules ?? [], { ...opts, input }))
  } catch (err: any) {
    console.error('[mapping/analyze] error', err)
    res.status(500).json({ error: err.message || 'Analyse fehlgeschlagen' })
  }
})

/** POST /api/mapping/review — Status-Übergang + Audit-Trail (Kap. 9). */
mappingRouter.post('/review', async (req, res) => {
  try {
    const { assessmentKey, decision, decidedBy, note } = req.body ?? {}
    if (!assessmentKey || (decision !== 'confirmed' && decision !== 'rejected') || !decidedBy) {
      res.status(400).json({ error: 'assessmentKey, decision (confirmed|rejected), decidedBy erforderlich' })
      return
    }
    // versioniertes Audit: pro assessmentKey Append-Record
    const existingRaw = await getAllEntities('mapping_reviews')
    if (existingRaw.length > 5000) {
      res.status(429).json({ error: 'Zu viele Review-Einträge — Cleanup erforderlich' })
      return
    }
    const id = `mv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const saved = await saveEntity('mapping_reviews', id, {
      assessmentKey,
      decision,
      decidedBy,
      note,
      status: decision === 'confirmed' ? 'confirmed' : 'rejected',
    })
    res.json(saved)
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Review-Verarbeitung fehlgeschlagen' })
  }
})

mappingRouter.get('/reviews', async (_req, res) => {
  try {
    res.json(await getAllEntities('mapping_reviews'))
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

/** POST /api/mapping/embeddings — Re-Index der Embeddings (pgvector, Kap. 6). */
mappingRouter.post('/embeddings', async (req, res) => {
  try {
    const { topK, threshold } = req.body ?? {}
    const cycles = (await getAllEntities('learning_cycles')) as LearningCycle[]
    if (!cycles.length) {
      res.status(400).json({ error: 'keine persistierten LearningCycles' })
      return
    }
    const host = process.env.MAPPING_OLLAMA_HOST
    if (!host) {
      res.status(409).json({ error: 'MAPPING_OLLAMA_HOST konfigurieren — Embeddings sind lokal nur heuristisch' })
      return
    }
    const provider = new OllamaEmbeddingProvider({ host, embeddingModel: process.env.MAPPING_EMBEDDING_MODEL ?? 'nomic-embed-text' })
    const model = process.env.MAPPING_EMBEDDING_MODEL ?? 'nomic-embed-text'
    const vectors = await provider.embed(cycles.map((c) => cycleText(c)))
    for (let i = 0; i < cycles.length; i++) {
      await saveCycleEmbedding(cycles[i]!.id, vectors[i]!, model, cycleTextHash(cycleText(cycles[i]!)))
    }
    const first = await findTopKSimilar(vectors[0]!, topK ?? 3, threshold ?? defaultMappingConfig().threshold, model)
    res.json({ embedded: cycles.length, modelId: model, topKForFirst: first })
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Embeddings fehlgeschlagen' })
  }
})
