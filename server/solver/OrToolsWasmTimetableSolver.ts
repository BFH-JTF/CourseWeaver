/**
 * Kap. 3.1 + 3.2 — CP-SAT Model Builder (Stufe 3)
 * Kennt keine Restriction-Objekte, nur SolverInput (Stufe 2).
 * Läuft serverseitig in Node.js; wird über Worker Thread isoliert (Kap. 2).
 */

import type { SolverInput } from './solverInput.js'
import type { RawSolverResult, SolveOptions, TimetableSolution } from './types.js'
import type { TimetableSolver } from './TimetableSolver.js'
import { explainSolution } from './explainSolution.js'

function slotsOverlap(a: string[], b: string[]): boolean {
  return a.some((s) => b.includes(s))
}

export class OrToolsWasmTimetableSolver implements TimetableSolver {
  constructor(private moduleNameById: Map<string, string> = new Map()) {}

  async solveRaw(input: SolverInput, options: SolveOptions = {}): Promise<RawSolverResult> {
    const start = Date.now()
    const { CpModel, CpSolver } = await import('or-tools-wasm/cp-sat')

    const model = new CpModel()

    const dayIndex = new Map(input.days.map((d, i) => [d.id, i]))
    const roomIndex = new Map(input.rooms.map((r, i) => [r.id, i]))
    const numDays = input.days.length
    const numRooms = input.rooms.length

    if (numDays === 0 || numRooms === 0 || input.sessions.length === 0) {
      throw new Error('SolverInput leer: days/rooms/sessions erforderlich')
    }

    const dayVars: any[] = []
    const roomVars: any[] = []

    for (const sess of input.sessions) {
      const allowedDayIndices = sess.allowedDayIds.map((id) => {
        const idx = dayIndex.get(id)
        if (idx === undefined) throw new Error(`Unbekannte dayId ${id} in Session ${sess.id}`)
        return idx
      })
      const allowedRoomIndices = sess.allowedRoomIds.map((id) => {
        const idx = roomIndex.get(id)
        if (idx === undefined) throw new Error(`Unbekannte roomId ${id} in Session ${sess.id}`)
        return idx
      })

      if (allowedDayIndices.length === 0) throw new Error(`Session ${sess.id}: keine erlaubten Tage`)
      if (allowedRoomIndices.length === 0) throw new Error(`Session ${sess.id}: keine erlaubten Räume`)

      const dv = model.newIntVar(0, numDays - 1, `day_${sess.id}`)
      const rv = model.newIntVar(0, numRooms - 1, `room_${sess.id}`)

      model.addAllowedAssignments([dv], allowedDayIndices.map((v) => [v]))
      model.addAllowedAssignments([rv], allowedRoomIndices.map((v) => [v]))

      dayVars.push(dv)
      roomVars.push(rv)
    }

    // Hard: Dozenten-Overlap – überlappende SlotTypes, gleicher Tag -> verboten
    for (let i = 0; i < input.sessions.length; i++) {
      for (let j = i + 1; j < input.sessions.length; j++) {
        const si = input.sessions[i]!
        const sj = input.sessions[j]!
        if (!slotsOverlap(si.slotTypes, sj.slotTypes)) continue
        const shared = si.instructorIds.some((id) => sj.instructorIds.includes(id))
        if (!shared) continue
        model.addAllDifferent([dayVars[i], dayVars[j]])
      }
    }

    // Hard: Raum-Kollision – gleiche (day,room) bei überlappenden Slots verboten
    // combined = day * numRooms + room, dann pairwise !=
    const combinedVars: any[] = input.sessions.map((_, idx) =>
      dayVars[idx].times(numRooms).plus(roomVars[idx]),
    )
    for (let i = 0; i < input.sessions.length; i++) {
      for (let j = i + 1; j < input.sessions.length; j++) {
        const si = input.sessions[i]!
        const sj = input.sessions[j]!
        if (!slotsOverlap(si.slotTypes, sj.slotTypes)) continue
        model.addAllDifferent([combinedVars[i], combinedVars[j]])
      }
    }

    // Hard: Weekly Balance – Bool isInWeek via AllowedAssignments Table
    for (const w of input.weeklyBalance.weeks) {
      const indicesInWeek = input.days
        .map((d, idx) => (d.week === w ? idx : -1))
        .filter((idx) => idx !== -1)
      if (indicesInWeek.length === 0) continue

      const bools: any[] = []
      for (let s = 0; s < input.sessions.length; s++) {
        const b = model.newBoolVar(`inWeek_${w}_${input.sessions[s]!.id}`)
        const allowedPairs: number[][] = []
        for (let d = 0; d < numDays; d++) {
          const isInW = indicesInWeek.includes(d) ? 1 : 0
          allowedPairs.push([isInW, d])
        }
        model.addAllowedAssignments([b, dayVars[s]], allowedPairs)
        bools.push(b)
      }
      // sum bools in [lower, upper]
      let expr = bools[0]
      for (let k = 1; k < bools.length; k++) expr = expr.plus(bools[k])
      model.addLinearConstraint(expr, input.weeklyBalance.lowerPerWeek, input.weeklyBalance.upperPerWeek)
    }

    // Objective: Soft-Penalties + early-days tie-breaker
    // Für jede (session, penalty) Bool isThisDay == (dayVar==dIdx) via Table
    let objective: any | null = null
    const penaltyTerms: any[] = []

    for (let s = 0; s < input.sessions.length; s++) {
      const sess = input.sessions[s]!
      for (const pen of sess.softPenalties) {
        const dIdx = dayIndex.get(pen.dayId)
        if (dIdx === undefined) continue
        const isThisDay = model.newBoolVar(`pen_${sess.id}_${pen.constraintId}_${dIdx}`)
        const allowedEq: number[][] = []
        for (let d = 0; d < numDays; d++) {
          allowedEq.push([d === dIdx ? 1 : 0, d])
        }
        model.addAllowedAssignments([isThisDay, dayVars[s]], allowedEq)
        // weight * bool
        const weighted = isThisDay.times(pen.weight)
        penaltyTerms.push(weighted)
      }
    }

    // Add penalty terms to objective
    if (penaltyTerms.length > 0) {
      objective = penaltyTerms[0]
      for (let i = 1; i < penaltyTerms.length; i++) objective = objective.plus(penaltyTerms[i])
    }

    // Always add small tie-breaker: frühe Tage bevorzugen (PREFER_EARLY_DATES)
    // Gewichtet gering (1) damit Soft-Penalties dominieren
    let earlyTerm = dayVars[0].times(1)
    for (let i = 1; i < dayVars.length; i++) earlyTerm = earlyTerm.plus(dayVars[i])
    if (objective) {
      // Skaliere Early-Term klein: + 0.1 * day – aber int only, daher + day
      // Das ist akzeptabel: day-Bevorzugung mit Gewicht 1 vs. Soft 10-20
      objective = objective.plus(earlyTerm)
    } else {
      // Fallback: nur early + room (falls keine softPenalties)
      let obj = earlyTerm
      for (let i = 0; i < roomVars.length; i++) obj = obj.plus(roomVars[i])
      objective = obj
    }

    model.minimize(objective)

    const solver = new CpSolver()
    const params: Record<string, unknown> = {
      numSearchWorkers: options.numSearchWorkers ?? 4,
    }
    if (options.timeLimitSeconds !== undefined) {
      ;(params as any).maxTimeInSeconds = options.timeLimitSeconds
    }
    if (options.randomSeed !== undefined) {
      ;(params as any).randomSeed = options.randomSeed
    }

    const statusCode = await solver.solve(model, params as any)
    const statusName = solver.statusName(statusCode) as RawSolverResult['status']
    const normalizedStatus: RawSolverResult['status'] =
      statusName === 'OPTIMAL' || statusName === 'FEASIBLE' || statusName === 'INFEASIBLE' ? statusName : 'UNKNOWN'

    const objectiveValue = (() => {
      try {
        return solver.objectiveValue()
      } catch {
        return 0
      }
    })()

    if (normalizedStatus === 'INFEASIBLE' || normalizedStatus === 'UNKNOWN') {
      return {
        status: normalizedStatus,
        objectiveValue,
        assignments: [],
        solveTimeMs: Date.now() - start,
      }
    }

    const assignments = input.sessions.map((sess, idx) => {
      const dIdx = solver.value(dayVars[idx])
      const rIdx = solver.value(roomVars[idx])
      const dayId = input.days[dIdx]!.id
      const roomId = input.rooms[rIdx]!.id
      return { sessionId: sess.id, dayId, roomId }
    })

    return {
      status: normalizedStatus,
      objectiveValue,
      assignments,
      solveTimeMs: Date.now() - start,
    }
  }

  async solve(input: SolverInput, options?: SolveOptions): Promise<TimetableSolution> {
    const raw = await this.solveRaw(input, options)
    return explainSolution(input, raw, this.moduleNameById)
  }
}
