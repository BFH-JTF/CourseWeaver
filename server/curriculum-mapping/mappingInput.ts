/**
 * Stufe 2 — buildMappingInput() (Kap. 2/2.1/11): "Kandidaten finden"
 * Günstige Vorfilterung auf plausibler Kandidatenpaare (nur Embeddings,
 * keine LLM-Aufrufe): topK pro LC + Mindest-Schwellenwert (Schritt 4),
 * Dedupe A-B/B-A (Schritt 5), Same-Module-Paare ausgeschlossen (Schritt 6).
 * Lexikalische Ähnlichkeit (Token-Jaccard) als Quercheck zum Embedding-Wert
 * (Kap. 9 Reaktionstabelle: Flag bei Widerspruch).
 */

import type {
  AlignmentCandidate,
  IrmLevel,
  LearningCycle,
  MappingConfig,
  MappingInput,
  OverlapCandidate,
} from './domain.js'

export type { AlignmentCandidate, IrmLevel, OverlapCandidate }

/** normierte Token ohne stemming; wenige Stopwords */
const STOPWORDS = new Set([
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'und', 'oder', 'ist',
  'in', 'im', 'für', 'mit', 'von', 'und', 'auf', 'zu', 'the', 'a', 'an', 'of', 'to', 'in', 'and', 'or',
])

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-zäöüàéèùâêîôûç0-9]+/i)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t) && !/^\d+$/.test(t))
}

function jaccard(a: string, b: string): number {
  const sa = new Set(tokenize(a))
  const sb = new Set(tokenize(b))
  if (sa.size === 0 && sb.size === 0) return 1
  let inter = 0
  for (const t of sa) if (sb.has(t)) inter++
  const union = sa.size + sb.size - inter
  return union === 0 ? 1 : inter / union
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) throw new Error('Embedding-Dimensionen identisch für Cosine')
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!
    na += a[i]! * a[i]!
    nb += b[i]! * b[i]!
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom === 0 ? 0 : dot / denom
}

/** Volltext eines LC für Embedding (Kap. 2.1 Schritt 1: learningGoals + mainContent, optional didactics) */
export function cycleText(c: LearningCycle): string {
  return [c.learningGoals, c.mainContent, c.didactics].filter(Boolean).join('\n\n')
}

/**
 * Kap. 2.1 / Kap. 8 Kalibrierung — plausible Startwerte, keine endgültige
 * Entscheidung: TOP_K = 5 und Schwellenwert um 0.75 (Embedding-Cosinus-Skala).
 * Der lexikalische Jaccard-Fallback hat eine andere Skala und nutzt deshalb
 * einen tieferen Default, wenn der Aufrufer keinen explizit setzt.
 */
export function defaultMappingConfig(): MappingConfig {
  return { threshold: 0.75, topK: 5, includeSameModule: false }
}

const DEFAULT_LEXICAL_THRESHOLD = 0.45

/**
 * Stufe 2 — Kap. 2.1, Schritt 3-6:
 *   3. Cosinus-Ähnlichkeit aller LC-Paare (innerhalb desselben Programms —
 *      der Aufrufer übergibt nur die LCs eines Programms),
 *   4. pro LC nur die topK ähnlichsten UND über dem Mindest-Schwellenwert,
 *   5. Duplikate raus (Paar A-B und B-A nur einmal),
 *   6. Paare aus demselben Modul standardmässig ausschliessen.
 * Günstig: nur Embeddings/lexikalisch, keine LLM-Aufrufe.
 */
export function buildMappingInput(
  cycles: LearningCycle[],
  opts: {
    program?: string
    /** vorab berechnete Embeddings (lcId -> vector); wenn fehlend, nur lexikalisch */
    embeddings?: Map<string, number[]>
    config?: Partial<MappingConfig>
  } = {},
): MappingInput {
  if (cycles.length === 0) throw new Error('buildMappingInput: cycles leer')
  const config: MappingConfig = { ...defaultMappingConfig(), ...opts.config }
  const hasEmbeddings = Boolean(opts.embeddings && opts.embeddings.size === cycles.length)
  // Jaccard-Skala ≠ Cosinus-Skala: ohne explizite Vorgabe tieferen Lexikal-Default nutzen
  const threshold = opts.config?.threshold ?? (hasEmbeddings ? config.threshold : DEFAULT_LEXICAL_THRESHOLD)

  const cyclesById = new Map(cycles.map((c) => [c.id, c]))
  const overlapCandidates: OverlapCandidate[] = []
  const seen = new Set<string>() // Schritt 5: Paar nur einmal (A-B und B-A)

  const pushCandidates = (
    cycleA: LearningCycle,
    similarities: Array<{ cycleB: LearningCycle; sim: number }>,
  ): void => {
    for (const { cycleB, sim } of similarities) {
      const key = [cycleA.id, cycleB.id].sort().join('::')
      if (seen.has(key)) continue
      seen.add(key)
      overlapCandidates.push({
        cycleAId: cycleA.id,
        cycleBId: cycleB.id,
        embeddingSimilarity: sim,
        lexicalSimilarity: jaccard(cycleText(cycleA), cycleText(cycleB)),
      })
    }
  }

  // Schritt 6: Paare desselben Moduls sind interne Modulstruktur, keine Redundanz-Frage
  const differentModules = (a: LearningCycle, b: LearningCycle): boolean =>
    config.includeSameModule || a.moduleId !== b.moduleId

  if (hasEmbeddings) {
    // Schritt 3/4: pro LC die topK ähnlichsten anderen LCs über Schwellenwert
    for (const cycleA of cycles) {
      const similarities = cycles
        .filter((cycleB) => cycleB.id !== cycleA.id && differentModules(cycleA, cycleB))
        .map((cycleB) => ({ cycleB, sim: cosineSimilarity(opts.embeddings!.get(cycleA.id)!, opts.embeddings!.get(cycleB.id)!) }))
        .filter(({ sim }) => sim >= threshold)
        .sort((x, y) => y.sim - x.sim)
        .slice(0, config.topK)
      pushCandidates(cycleA, similarities)
    }
  } else {
    // Fallback: ohne Embeddings rein lexikalisch (Jaccard über Schwellenwert),
    // identische topK/Dedupe/Same-Module-Semantik
    for (const cycleA of cycles) {
      const similarities = cycles
        .filter((cycleB) => cycleB.id !== cycleA.id && differentModules(cycleA, cycleB))
        .map((cycleB) => ({ cycleB, sim: jaccard(cycleText(cycleA), cycleText(cycleB)) }))
        .filter(({ sim }) => sim >= threshold)
        .sort((x, y) => y.sim - x.sim)
        .slice(0, config.topK)
      pushCandidates(cycleA, similarities)
    }
  }

  // Alignment-Kandidaten: LC mit level + assignmentType getrennt betrachten (Kap. 2)
  const alignmentCandidates: AlignmentCandidate[] = cycles
    .filter((c) => c.level && c.assignmentType)
    .map((c) => ({ cycleId: c.id }))

  return {
    overlapCandidates,
    alignmentCandidates,
    cyclesById: cyclesById,
    program: opts.program ?? 'default',
  }
}

/** Lexikalische Ähnlichkeits-Map pairKey(a,b) -> Jaccard, für die Heuristik. */
export function lexicalSimilarityMap(cycles: LearningCycle[]): Map<string, number> {
  const out = new Map<string, number>()
  for (let i = 0; i < cycles.length; i++) {
    for (let j = i + 1; j < cycles.length; j++) {
      const a = cycles[i]!
      const b = cycles[j]!
      const similarity = jaccard(cycleText(a), cycleText(b))
      // gleiche Key-Konvention wie Heuristik-Bewerter (sortiert, '::')
      const key = [a.id, b.id].sort().join('::')
      out.set(key, similarity)
    }
  }
  return out
}
