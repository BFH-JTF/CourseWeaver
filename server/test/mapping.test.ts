/**
 * Unit-Tests Curriculum Mapping (Kap. 11 Checkliste, Backend-Teil):
 *  - Kataloge: stabile IDs (Backend & Frontend teilen Farben/Prioritäten)
 *  - buildMappingInput: topK + Schwelle; Alignment-Kandidaten getrennt
 *  - Heuristik-Overlap: Progression vs. Substantial (I-R-M macht den Unterschied)
 *  - Alignment-Heuristik: zu flach / fehlend / zu fordernd
 *  - explainCurriculumMap: Matrix-Aggregation, Progression, getrennte Prüflisten,
 *    Review-Status ai_suggested, Coverage-Rows, Reaktionstabelle (Widerspruch)
 *  - Concurrency-Limiter: max N gleichzeitig
 */
import assert from 'node:assert'
import { buildMappingInput, lexicalSimilarityMap, tokenize, cosineSimilarity } from '../curriculum-mapping/mappingInput.js'
import { analyzeWithHeuristics, findCandidates } from '../curriculum-mapping/pipeline.js'
import {
  createConcurrencyLimiter,
  createHeuristicAlignmentAssessor,
  createHeuristicOverlapAssessor,
  withRetry,
  assessReviewPriority,
} from '../curriculum-mapping/assessors.js'
import { buildCoverage } from '../curriculum-mapping/explain.js'
import { RELATIONSHIP_CATALOG, ALIGNMENT_CATALOG } from '../curriculum-mapping/catalog.js'
import type { LearningCycle } from '../curriculum-mapping/domain.js'

console.log('--- Starting Curriculum Mapping Unit Tests ---')

function cycle(id: string, moduleId: string, struct: string, goals: string, content: string, level?: LearningCycle['level'], assignmentType?: LearningCycle['assignmentType']): LearningCycle {
  return {
    id, moduleId, structuralElement: struct,
    learningGoals: goals, mainContent: content, didactics: 'Fallstudie',
    assignmentType, assignmentDescription: assignmentType ? 'Analyseaufgabe' : undefined,
    level, sourceFile: 'test.xlsx', sourceRow: 1, version: 'v1',
  }
}

const lcA = cycle('lc-a1', 'mod-a', 'Learning Cycle 1', 'Studierende können digitale Wertschöpfungsketten beschreiben', 'Digitale Wertschöpfung, Plattform-Geschäftsmodelle, Disruption', 'I', 'Graded')
const lcA2 = cycle('lc-a2', 'mod-a', 'Learning Cycle 2', 'Studierende können Business Model Canvas anwenden', 'Business Model Canvas, Value Proposition', 'R', 'Graded')
const lcB1 = cycle('lc-b1', 'mod-b', 'Learning Cycle 1', 'Studierende können digitale Wertschöpfungsketten beschreiben', 'Digitale Wertschöpfung, Plattform-Modelle', 'R', 'Graded')
const lcC = cycle('lc-c1', 'mod-c', 'Learning Cycle 3', 'Studierende erstellen einen Venture-Capital-Pitch', 'Pitching, Finanzierung, Storytelling', 'M', 'Pass/Fail')
const cycles = [lcA, lcA2, lcB1, lcC]
const modules = [
  { id: 'mod-a', name: 'Module A', program: 'prog-dba' },
  { id: 'mod-b', name: 'Module B', program: 'prog-dba' },
  { id: 'mod-c', name: 'Module C', program: 'prog-dba' },
]

// 1. Tokenizer + Jaccard/lexical map — die Keys folgen der sorted '::'-Konvention
assert.ok(tokenize('Digitale Wertschöpfung, Plattform-Modelle!').includes('wertschöpfung'))
const lexMap = lexicalSimilarityMap([lcA, lcB1])
assert.ok(lexMap.get('lc-a1::lc-b1')! > 0.2, 'gemeinsame Key-Primitive, lexikalische Overlap erkannt')
console.log('✓ tokenize/Jaccard passed')

// 2. mapping — topK + Schwellenwert (Kap. 2 Stufe 1-Filter)
{
  const input = buildMappingInput(cycles, { config: { threshold: 0.1, topK: 1 } })
  assert.ok(input.overlapCandidates.some((c) => (c.cycleAId === 'lc-a1' && c.cycleBId === 'lc-b1')), 'a1×b1 Kandidat')
  assert.ok(input.overlapCandidates.every((c) => c.lexicalSimilarity !== undefined && c.embeddingSimilarity > 0))
  // Alignment-Kandidaten: alle LCs mit level & assignmentType (alle hier)
  assert.strictEqual(input.alignmentCandidates.length, 4)
  console.log('✓ buildMappingInput candidates passed')
}

// 2b. Kap. 2.1 Schritt 6 — Paare aus demselben Modul standardmässig ausschliessen
{
  const input = buildMappingInput(cycles, { config: { threshold: 0.1, topK: 5 } })
  assert.ok(
    input.overlapCandidates.every((c) => {
      const a = cycles.find((x) => x.id === c.cycleAId)
      const b = cycles.find((x) => x.id === c.cycleBId)
      return a && b && a.moduleId !== b.moduleId
    }),
    'kein Same-Module-Paar im Default',
  )
  // mit includeSameModule sind sie wieder dabei (Möglichkeit, es einzuschalten)
  const incl = buildMappingInput(cycles, { config: { threshold: 0.1, topK: 5, includeSameModule: true } })
  assert.ok(incl.overlapCandidates.some((c) => c.cycleAId === 'lc-a1' && c.cycleBId === 'lc-a2'), 'Same-Module optional einschaltbar')
  console.log('✓ same-module exclusion (Schritt 6) passed')
}

// 2c. Kap. 2.1 Schritt 4/5 — topK pro LC über Schwellenwert, Dedupe A-B/B-A
{
  // lc-a1 und lc-b1 haben fast identische Lernziele: jeder nimmt den anderen in die
  // Top-K auf — das Paar darf trotzdem nur EINMAL auftauchen (Dedupe, Schritt 5)
  const input = buildMappingInput([lcA, lcB1], { config: { threshold: 0.1, topK: 5 } })
  const pairCount = input.overlapCandidates.filter(
    (c) => [c.cycleAId, c.cycleBId].sort().join('::') === 'lc-a1::lc-b1',
  ).length
  assert.strictEqual(pairCount, 1, 'Paar A-B und B-A nur einmal')
  console.log('✓ topK/dedupe semantics (Schritt 4/5) passed')
}

// 3. Cosine-Dimension-Validation
assert.throws(() => cosineSimilarity([1, 2], [1, 2, 3]))
assert.ok(Math.abs(cosineSimilarity([1, 0, 0], [1, 0, 0]) - 1) < 1e-9)
console.log('✓ cosineSimilarity guard passed')

// 4. analyzeWithHeuristics End-to-End (Kap. 5: Overlap + Alignment getrennt)
{
  const map = await analyzeWithHeuristics(cycles, modules, { program: 'prog-dba', threshold: 0.1, topK: 3 })
  // a1×b1: gleiche Ziele, gleiche Niveau? A=I, B=R → PROGRESSION laut I-R-M-Logik
  const pair = map.moduleMatrix.find((s) => [s.moduleAId, s.moduleBId].sort().join('') === 'mod-amod-b')
  assert.ok(pair, 'Modul-Matrix enthält mod-a×mod-b')
  assert.strictEqual(pair.entries[0].assessment.relationship, 'PROGRESSION', 'I steigt auf R → Progression, kein Duplicate')
  // Duplikat-Heuristik: gleiche Inhalte, gleiches Niveau (Same-Module-Vergleich
  // bewusst eingeschaltet — Kap. 2.1 Schritt 6 schliesst ihn im Default aus)
  const map2 = await analyzeWithHeuristics([lcB1, cycle('lc-b2', 'mod-b', 'LC2', lcB1.learningGoals, lcB1.mainContent, 'R', 'Graded')], modules, { threshold: 0.1, topK: 3, includeSameModule: true })
  assert.strictEqual(map2.moduleMatrix[0].entries[0].assessment.relationship, 'DUPLICATE', 'gleicher Inhalt + gleiches Niveau → Redundanz')
  // Alignment-Befunde unabhängig (Kap. 5): M-Level + Pass/Fail → TOO_SHALLOW
  assert.ok(map.openReview.alignments.some((a) => a.observation.mismatch === 'ASSESSMENT_TOO_SHALLOW' && a.cycleId === 'lc-c1'))
  // threshhold-Status: alle ai_suggested (Versionierung folgt beim Review)
  assert.ok(map.openReview.overlaps.every((o) => o.status === 'ai_suggested'))
  console.log('✓ analyzeWithHeuristics End-to-End passed')
}

// 4b. Zweiphasiger Flow (Kap. 2.1): findCandidates (Stufe 2, günstig) →
//     analyzeWithHeuristics mit vorberechnetem Input (Stufe 3/4, ohne Re-Embedding)
{
  const built = await findCandidates(cycles, { program: 'prog-dba', threshold: 0.1, topK: 3 })
  assert.strictEqual(built.mode, 'lexical', 'ohne EmbeddingProvider → lexikalischer Modus')
  assert.ok(built.input.overlapCandidates.length > 0, 'Kandidaten gefunden')
  assert.strictEqual(built.embeddingStats.total, 0)
  const map = await analyzeWithHeuristics(cycles, modules, { program: 'prog-dba', input: built.input })
  const pair = map.moduleMatrix.find((s) => [s.moduleAId, s.moduleBId].sort().join('') === 'mod-amod-b')
  assert.ok(pair, 'vorberechneter Input führt zur selben Matrix')
  console.log('✓ two-phase findCandidates → analyze passed')
}

// 5. Heuristischer Alignment-Assessor direkt
{
  const assessor = createHeuristicAlignmentAssessor()
  const tooShallow = await assessor.assess({ ...lcC })
  assert.strictEqual(tooShallow.observedCognitiveLevel, 'application')
  assert.strictEqual(tooShallow.mismatch, 'ASSESSMENT_TOO_SHALLOW')
  assert.strictEqual(tooShallow.assessmentMatchesLevel, false)
  assert.strictEqual(tooShallow.claimedLevel, 'M')
  console.log('✓ heuristic alignment assessor passed')
}

// 6. Reaktionstabelle (Kap. 9): Widerspruch lifting
assert.strictEqual(assessReviewPriority({ relationship: 'PROGRESSION', llmConfidence: 0.9, embeddingSimilarity: 0.9, lexicalSimilarity: 0.9 }), 'low')
assert.strictEqual(assessReviewPriority({ relationship: 'PROGRESSION', llmConfidence: 0.9, embeddingSimilarity: 0.9, lexicalSimilarity: 0.1 }), 'medium', 'Embedding↔lexical widersprüchlich → Stufe hoch (low→medium)')
assert.strictEqual(assessReviewPriority({ relationship: 'DUPLICATE', llmConfidence: 0.3, embeddingSimilarity: 0.8 }), 'high')
console.log('✓ review priority ladder passed')

// 7. Concurrency-Limiter (Kap. 7): max N gleichzeitig, Reihenfolge converviert
{
  let concurrent = 0
  let peak = 0
  const limit = createConcurrencyLimiter(2)
  await Promise.all(
    Array.from({ length: 6 }, () =>
      limit(async () => {
        concurrent++
        peak = Math.max(peak, concurrent)
        await new Promise((r) => setTimeout(r, 10))
        concurrent--
      }),
    ),
  )
  assert.strictEqual(peak, 2, `max ${2} gleichzeitig, peak war ${peak}`)
}
// 8. withRetry ok
{
  let calls = 0
  const result = await withRetry(async () => {
    calls++
    if (calls < 2) throw new Error('429 flaky')
    return 'ok'
  }, { retries: 3, baseDelayMs: 1 })
  assert.strictEqual(result, 'ok')
  assert.strictEqual(calls, 2)
}
console.log('✓ concurrency limiter & retry passed')

// 9. Coverage-Building: Level-Buckets + Alignment-Issues
{
  const map = await analyzeWithHeuristics(cycles, modules, { threshold: 0.1 })
  assert.ok(map.coverage.length >= 3, 'mindestens Themenzeilen: ' + map.coverage.length)
  const hasIssue = map.coverage.some((c) => c.alignmentIssues.length > 0)
  assert.ok(hasIssue, 'alignmentIssues in Coverage')
  void buildCoverage
  console.log('✓ coverage map passed')
}

// 10. Katalog-Integrität: jeder typedefinierte Katalogeintrag mit Farbe + Priorität
for (const [id, entry] of Object.entries(RELATIONSHIP_CATALOG)) {
  assert.strictEqual(entry.id, id)
  assert.ok(['red', 'amber', 'green', 'grey'].includes(entry.color))
  assert.ok(['high', 'medium', 'low', 'none'].includes(entry.reviewPriority))
}
for (const [id, entry] of Object.entries(ALIGNMENT_CATALOG)) {
  assert.strictEqual(entry.id, id)
  assert.ok(['red', 'amber', 'grey'].includes(entry.color))
}
console.log('✓ catalogs stable ids/colors passed')

console.log('--- All Curriculum Mapping Unit Tests Passed ---')
