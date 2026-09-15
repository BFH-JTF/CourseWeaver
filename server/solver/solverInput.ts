/**
 * Stufe 2 — validierter SolverInput
 * Fachlich neutral, nur noch das was der Solver braucht.
 * Hier liegt die Filter-Logik (isDayAllowed / isRoomAllowed), die bisher
 * in schedule-model.js direkt im Modell verstreut war.
 */

import type { Module, OnCampusDay, Room, SlotType } from './domain.js'
import { CONSTRAINT_CATALOG, resolveWeight } from './constraintCatalog.js'

export interface SolverSession {
  id: string
  moduleId: string
  slotTypes: SlotType[] // ['vormittag'] oder ['vormittag','nachmittag'] = ganzer Tag, ['abend'] separat
  expectedStudents: number
  instructorIds: string[]
  allowedDayIds: string[] // bereits gegen harte Restriktionen gefiltert
  allowedRoomIds: string[] // bereits gegen Kapazität gefiltert
  softPenalties: Array<{ dayId: string; constraintId: string; weight: number }>
}

export interface SolverInput {
  sessions: SolverSession[]
  days: OnCampusDay[]
  rooms: Room[]
  weeklyBalance: { weeks: number[]; lowerPerWeek: number; upperPerWeek: number }
}

export interface BuildSolverInputOptions {
  /** Wochenbalance explizit setzen – sonst auto aus days */
  weeklyBalance?: SolverInput['weeklyBalance']
  /** Fallback falls Modul keine SlotTypes via Restriction definiert: 6 ECTS = ganzer Tag */
  defaultSlotTypes?: (ects: 3 | 6) => SlotType[]
}

// ---------------------------------------------------------------------------
// Helpers: Restriction-Auswertung – rein funktional, testbar
// ---------------------------------------------------------------------------

function getDatesParam(r: { params?: Record<string, unknown> }): string[] {
  const v = r.params?.['dates']
  return Array.isArray(v) ? (v as string[]) : []
}

function getWeekdaysParam(r: { params?: Record<string, unknown> }): string[] {
  const v = r.params?.['weekdays']
  return Array.isArray(v) ? (v as string[]) : []
}

function getPhasesParam(r: { params?: Record<string, unknown> }): string[] {
  const v = r.params?.['phases']
  return Array.isArray(v) ? (v as string[]) : []
}

function defaultSlotTypesForEcts(ects: 3 | 6): SlotType[] {
  // 3 ECTS: halber Tag (vormittag) – in Realität variabel; 6 ECTS: ganzer Tag
  // Wird nur verwendet wenn keine FIXED_SLOT Restriktion existiert.
  // Abend ist nur via Restriction { id: 'REQUIRE_EVENING', ... } o.ä.
  return ects === 3 ? ['vormittag'] : ['vormittag', 'nachmittag']
}

function isDayAllowedForModule(day: OnCampusDay, mod: Module): boolean {
  for (const r of mod.restrictions) {
    if (r.category !== 'hard') continue
    switch (r.id) {
      case 'UNAVAILABLE_DATES': {
        const blocked = new Set(getDatesParam(r))
        if (blocked.has(day.date)) return false
        break
      }
      case 'FIXED_DAY': {
        const fixed = new Set(getDatesParam(r))
        // Wenn FIXED_DAY gesetzt, nur diese Daten erlaubt (OR über mehrere Einträge)
        if (fixed.size > 0 && !fixed.has(day.date)) return false
        break
      }
      case 'ALLOWED_WEEKDAYS': {
        const allowed = getWeekdaysParam(r)
        if (allowed.length > 0 && !allowed.includes(day.weekday)) return false
        break
      }
      case 'ALLOWED_PHASE': {
        const allowed = getPhasesParam(r)
        if (allowed.length > 0 && !allowed.includes(day.phase)) return false
        break
      }
      default:
        // unbekannte harte Restriktion hier ignorieren – wird im Solver später als Raum-/Lehrer-Constraint behandelt
        break
    }
  }
  return true
}

function buildSoftPenalties(
  day: OnCampusDay,
  slotTypes: SlotType[],
  mod: Module,
): Array<{ dayId: string; constraintId: string; weight: number }> {
  const penalties: Array<{ dayId: string; constraintId: string; weight: number }> = []
  for (const r of mod.restrictions) {
    if (r.category !== 'soft') continue
    const weight = resolveWeight(r.id, r.weight)
    switch (r.id) {
      case 'AVOID_FRIDAY_AFTERNOON':
        if (day.weekday === 'Freitag' && slotTypes.includes('nachmittag')) {
          penalties.push({ dayId: day.id, constraintId: r.id, weight })
        }
        break
      case 'AVOID_SATURDAY':
        if (day.weekday === 'Samstag') penalties.push({ dayId: day.id, constraintId: r.id, weight })
        break
      case 'AVOID_EVENING':
        if (slotTypes.includes('abend')) penalties.push({ dayId: day.id, constraintId: r.id, weight })
        break
      case 'PREFER_MORNING':
        // Penalty wenn NICHT vormittag – invertierte Präferenz
        if (!slotTypes.includes('vormittag')) penalties.push({ dayId: day.id, constraintId: r.id, weight })
        break
      default: {
        // Generisch: falls params.dates enthält und day darauf fällt → Penalty
        const dates = getDatesParam(r)
        if (dates.includes(day.date)) penalties.push({ dayId: day.id, constraintId: r.id, weight })
        break
      }
    }
  }
  // Immer kleiner Tie-Breaker für frühe Daten (falls im Katalog enabled)
  if (CONSTRAINT_CATALOG.PREFER_EARLY_DATES.enabled) {
    // wird nicht pro-Modul, sondern global im Solver als Objective gewichtet – hier leer lassen
  }
  return penalties
}

// ---------------------------------------------------------------------------
// Public: buildSolverInput
// Diese Funktion trägt die ganze fachliche Interpretation der Restriktionen.
// Der CP-SAT Model Builder (Stufe 3) kennt danach keine Restriction-Objekte mehr,
// nur noch Listen erlaubter IDs und vorgerechnete Strafkosten.
// ---------------------------------------------------------------------------

export function buildSolverInput(
  modules: Module[],
  days: OnCampusDay[],
  rooms: Room[],
  options: BuildSolverInputOptions = {},
): SolverInput {
  if (modules.length === 0) throw new Error('buildSolverInput: modules leer')
  if (days.length === 0) throw new Error('buildSolverInput: days leer')
  if (rooms.length === 0) throw new Error('buildSolverInput: rooms leer')

  const slotForEcts = options.defaultSlotTypes ?? defaultSlotTypesForEcts

  // Validierung: ECTS, Students
  for (const m of modules) {
    if (m.ects !== 3 && m.ects !== 6) throw new Error(`Modul ${m.id}: ects muss 3 oder 6 sein`)
    if (m.expectedStudents < 0) throw new Error(`Modul ${m.id}: expectedStudents negativ`)
    if (m.instructors.length === 0) throw new Error(`Modul ${m.id}: mindestens ein Instructor erforderlich`)
  }

  const sessions: SolverSession[] = modules.map((mod) => {
    // SlotTypes bestimmen: Falls Restriktion ALLOWED_SLOT_TYPES o.ä. existiert, nutze diese;
    // für dieses Modell: aus FIXED_SLOT param oder ECTS-Fallback
    const slotRestriction = mod.restrictions.find((r) => r.id === 'FIXED_SLOT')
    let slotTypes: SlotType[]
    if (slotRestriction?.params?.['slotTypes'] && Array.isArray(slotRestriction.params['slotTypes'])) {
      slotTypes = slotRestriction.params['slotTypes'] as SlotType[]
    } else {
      slotTypes = slotForEcts(mod.ects)
    }

    // Harte Tages-Filter
    const allowedDays = days.filter((d) => isDayAllowedForModule(d, mod))
    if (allowedDays.length === 0) {
      throw new Error(`Modul ${mod.id} (${mod.name}): keine erlaubten Tage nach harten Filtern (Prüfe UNAVAILABLE_DATES/FIXED_DAY)`)
    }

    // Harte Raum-Filter: Kapazität
    const allowedRooms = rooms.filter((r) => r.capacity >= mod.expectedStudents)
    if (allowedRooms.length === 0) {
      throw new Error(`Modul ${mod.id}: kein Raum erfüllt Kapazität ${mod.expectedStudents} (max verfügbar ${Math.max(...rooms.map((r) => r.capacity))})`)
    }

    // Soft Penalties je Tag
    const softPenalties: SolverSession['softPenalties'] = []
    for (const d of allowedDays) {
      softPenalties.push(...buildSoftPenalties(d, slotTypes, mod))
    }

    return {
      id: `session-${mod.id}`,
      moduleId: mod.id,
      slotTypes,
      expectedStudents: mod.expectedStudents,
      instructorIds: [...mod.instructors],
      allowedDayIds: allowedDays.map((d) => d.id),
      allowedRoomIds: allowedRooms.map((r) => r.id),
      softPenalties,
    }
  })

  // Wochenbalance
  let weeklyBalance: SolverInput['weeklyBalance']
  if (options.weeklyBalance) {
    weeklyBalance = options.weeklyBalance
  } else {
    const weeks = [...new Set(days.map((d) => d.week))].sort((a, b) => a - b)
    // Default: gleichmässig verteilen, ±1 Toleranz
    const total = sessions.length
    const w = weeks.length || 1
    const avg = Math.floor(total / w)
    weeklyBalance = {
      weeks,
      lowerPerWeek: Math.max(0, avg - 1),
      upperPerWeek: avg + 2,
    }
  }

  return { sessions, days, rooms, weeklyBalance }
}
