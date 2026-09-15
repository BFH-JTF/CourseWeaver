/**
 * Solver Service – verwaltet Worker Threads (Kap. 2 Jobs überwachbar/abbrechbar)
 * Fällt zurück auf In-Prozess wenn Worker nicht gewünscht (Tests).
 */

import { Worker } from 'node:worker_threads'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { SolverInput } from './solverInput.js'
import type { RawSolverResult, SolveOptions, TimetableSolution } from './types.js'
import { OrToolsWasmTimetableSolver } from './OrToolsWasmTimetableSolver.js'
import { explainSolution } from './explainSolution.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export interface JobHandle {
  promise: Promise<TimetableSolution>
  abort: () => void
}

export function solveInWorker(
  input: SolverInput,
  options: SolveOptions = {},
  moduleNameById: Map<string, string> = new Map(),
  timeoutSeconds?: number,
): JobHandle {
  const effectiveOptions: SolveOptions = {
    timeLimitSeconds: timeoutSeconds ?? options.timeLimitSeconds ?? 60,
    numSearchWorkers: options.numSearchWorkers ?? 4,
    randomSeed: options.randomSeed,
  }

  let worker: Worker | null = null
  let rejectOuter: ((e: Error) => void) | null = null
  let timeout: NodeJS.Timeout | null = null

  const promise = new Promise<TimetableSolution>((resolve, reject) => {
    rejectOuter = reject

    const workerPath = path.join(__dirname, 'worker', 'solverWorker.js')
    // tsx/worker benötigt .ts Pfad – bei ESM läuft Worker mit tsx Loader
    // Wir versuchen .ts, fallback .js
    const tryPaths = [
      path.join(__dirname, 'worker', 'solverWorker.ts'),
      workerPath,
    ]

    const workerFile = tryPaths[0] // tsx watch kann .ts laden

    try {
      worker = new Worker(workerFile, {
        workerData: {
          input,
          options: effectiveOptions,
          moduleNameByIdEntries: [...moduleNameById.entries()],
        },
        // Wichtig: tsx loader via execArgv wird von parent geerbt
      } as any)
    } catch (e: any) {
      // Fallback: in-prozess (z.B. wenn worker_threads nicht verfügbar)
      const solver = new OrToolsWasmTimetableSolver(moduleNameById)
      solver
        .solve(input, effectiveOptions)
        .then(resolve)
        .catch(reject)
      return
    }

    const killTimeout = (effectiveOptions.timeLimitSeconds! + 5) * 1000
    timeout = setTimeout(() => {
      worker?.terminate()
      reject(new Error(`Solver Worker Timeout nach ${killTimeout}ms`))
    }, killTimeout)

    let settled = false
    worker.on('message', (msg: any) => {
      if (settled) return
      settled = true
      if (timeout) clearTimeout(timeout)
      if (msg.ok) {
        const raw = msg.raw as RawSolverResult
        const solution = explainSolution(input, raw, moduleNameById)
        resolve(solution)
      } else {
        // Fallback in-prozess bei Worker-Fehler (z.B. unknown file extension)
        const solver = new OrToolsWasmTimetableSolver(moduleNameById)
        solver.solve(input, effectiveOptions).then(resolve).catch(reject)
      }
      worker?.terminate()
    })

    worker.on('error', (err: any) => {
      if (settled) return
      settled = true
      if (timeout) clearTimeout(timeout)
      // Fallback in-prozess – Worker nicht verfügbar (tsx loader fehlt)
      console.warn('[solverService] Worker fehlgeschlagen, fallback in-prozess:', err.message)
      const solver = new OrToolsWasmTimetableSolver(moduleNameById)
      solver.solve(input, effectiveOptions).then(resolve).catch(reject)
      worker?.terminate()
    })

    worker.on('exit', (code) => {
      if (settled) return
      if (code !== 0) {
        settled = true
        if (timeout) clearTimeout(timeout)
        console.warn(`[solverService] Worker exit ${code}, fallback in-prozess`)
        const solver = new OrToolsWasmTimetableSolver(moduleNameById)
        solver.solve(input, effectiveOptions).then(resolve).catch(reject)
      }
    })
  })

  return {
    promise,
    abort: () => {
      if (timeout) clearTimeout(timeout)
      worker?.terminate()
      rejectOuter?.(new Error('Solver abgebrochen'))
    },
  }
}

/** Convenience ohne Worker – direkt im Prozess (Tests, kleine Instanzen) */
export async function solveInProcess(
  input: SolverInput,
  options: SolveOptions = {},
  moduleNameById: Map<string, string> = new Map(),
): Promise<TimetableSolution> {
  const solver = new OrToolsWasmTimetableSolver(moduleNameById)
  return solver.solve(input, options)
}
