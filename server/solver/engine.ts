/**
 * Kap. 3 — Hybride Engine-Auswahl für den TimetableSolver.
 *
 * Default: `cp-sat-ts` (pure TypeScript, https://github.com/hedypamungkas/cp-sat-typescript)
 * — für kleine bis mittlere Instanzen. Das Engine-Paket ist neu und kann bei
 * grossen Instanzen (viele pairwise AllDifferent + Objective) bis zum Zeitlimit
 * KEINE erstloesbare Lösung liefern (Benchmark: UNKNOWN statt FEASIBLE).
 * Deshalb: HybridTimetableSolver — cp-sat-ts zuerst; wenn keine brauchbare
 * Lösung herauskommt, transparent ein Fallback auf or-tools-wasm.
 *
 * SOLVER_ENGINE=or-tools-wasm erzwingt die Alt-Engine ohne Fallback,
 * SOLVER_ENGINE=cp-sat-ts-only erzwingt cp-sat-ts OHNE Fallback.
 */

import { CpSatTsTimetableSolver } from './CpSatTsTimetableSolver.js'
import { OrToolsWasmTimetableSolver } from './OrToolsWasmTimetableSolver.js'
import type { TimetableSolver } from './TimetableSolver.js'
import type { SolverInput } from './solverInput.js'
import type { RawSolverResult, SolveOptions, TimetableSolution } from './types.js'
import { explainSolution } from './explainSolution.js'

export type SolverEngineId = 'cp-sat-ts' | 'or-tools-wasm'

export function resolveSolverEngine(): SolverEngineId {
  const env = (process.env.SOLVER_ENGINE ?? 'cp-sat-ts').toLowerCase()
  return env === 'or-tools-wasm' ? 'or-tools-wasm' : 'cp-sat-ts'
}

/** cp-sat-ts-Ergebnis ist verwertbar, wenn eine Lösung (oder fast-UNSAT) vorliegt. */
function usable(raw: RawSolverResult): boolean {
  return raw.status === 'OPTIMAL' || raw.status === 'FEASIBLE'
}

/**
 * Kap. 5 Bench-Messung 2026-09: die pure-TS-Engine produziert bei grossen
 * Instanzen (viele pairwise-AllDifferent + Objective) keine Erstlösung im
 * Zeitlimit — dann wäre der cp-sat-ts-Vorlauf verschwendete Zeit. Ab dieser
 * Session-Anzahl direkt or-tools verwenden (env-überschreibbar).
 */
const BIG_INSTANCE_SESSIONS = Number(process.env.SOLVER_BIG_INSTANCE_SESSIONS ?? 60)

export class HybridTimetableSolver implements TimetableSolver {
  constructor(private moduleNameById: Map<string, string> = new Map()) {}

  async solveRaw(input: SolverInput, options: SolveOptions = {}): Promise<RawSolverResult> {
    const solverEnv = process.env.SOLVER_ENGINE?.toLowerCase()
    const allowFallback = solverEnv !== 'cp-sat-ts-only' && solverEnv !== 'or-tools-wasm'

    if (solverEnv === 'or-tools-wasm') {
      return new OrToolsWasmTimetableSolver(this.moduleNameById).solveRaw(input, options)
    }

    if (!allowFallback || input.sessions.length > BIG_INSTANCE_SESSIONS) {
      // gross: cp-sat-ts-Versuch wäre Budget-Verschwendung → direkt or-tools
      return new OrToolsWasmTimetableSolver(this.moduleNameById).solveRaw(input, options)
    }

    const primary = new CpSatTsTimetableSolver(this.moduleNameById)
    const raw = await primary.solveRaw(input, options)
    if (usable(raw)) return raw

    console.warn(
      `[engine] cp-sat-ts lieferte '${raw.status}'` +
        ` (keine bewertbare Lösung) — Fallback auf or-tools-wasm.`,
    )
    const fallback = new OrToolsWasmTimetableSolver(this.moduleNameById)
    const fallbackRaw = await fallback.solveRaw(input, options)
    // beide Engines verbrauchten Zeit: addieren
    return { ...fallbackRaw, solveTimeMs: (raw.solveTimeMs ?? 0) + (fallbackRaw.solveTimeMs ?? 0) }
  }

  async solve(input: SolverInput, options?: SolveOptions): Promise<TimetableSolution> {
    const raw = await this.solveRaw(input, options)
    return explainSolution(input, raw, this.moduleNameById)
  }
}

export function createTimetableSolver(moduleNameById: Map<string, string> = new Map()): TimetableSolver {
  return resolveSolverEngine() === 'or-tools-wasm'
    ? new OrToolsWasmTimetableSolver(moduleNameById)
    : new HybridTimetableSolver(moduleNameById)
}
