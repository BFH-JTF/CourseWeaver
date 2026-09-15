/**
 * Constraint-Katalog mit stabilen IDs (Kap. 3.3)
 * Jede Regel hat feste ID, Kategorie und Gewicht.
 * Wird sowohl von buildSolverInput (Stufe 2) als auch von explainSolution (Stufe 4) verwendet.
 */

export type ConstraintCategory = 'hard' | 'soft'

export interface ConstraintDefinition {
  id: string
  category: ConstraintCategory
  weight: number // hard: 1 (irrelevant, erzwingt Filter), soft: Strafgewicht
  enabled: boolean
  description: string
}

/**
 * Stabile IDs – nie umbenennen, nur deprecaten.
 * Neue Regeln hier ergänzen, nicht hart codiert im Modell verstecken.
 */
export const CONSTRAINT_CATALOG = {
  // --- Hard: Filter erzeugen allowedDayIds / allowedRoomIds
  NO_TEACHER_OVERLAP: {
    id: 'NO_TEACHER_OVERLAP',
    category: 'hard' as const,
    weight: 1,
    enabled: true,
    description: 'Dozent darf nicht in überlappenden SlotTypes am selben Tag in zwei Modulen sein',
  },
  ROOM_CAPACITY: {
    id: 'ROOM_CAPACITY',
    category: 'hard' as const,
    weight: 1,
    enabled: true,
    description: 'Raumkapazität muss expectedStudents erfüllen',
  },
  ROOM_OCCUPANCY: {
    id: 'ROOM_OCCUPANCY',
    category: 'hard' as const,
    weight: 1,
    enabled: true,
    description: 'Raum darf nicht in überlappenden SlotTypes am selben Tag doppelt belegt sein',
  },
  UNAVAILABLE_DATES: {
    id: 'UNAVAILABLE_DATES',
    category: 'hard' as const,
    weight: 1,
    enabled: true,
    description: 'Harte Sperrzeiten pro Modul (params: { dates: string[] })',
  },
  ALLOWED_WEEKDAYS: {
    id: 'ALLOWED_WEEKDAYS',
    category: 'hard' as const,
    weight: 1,
    enabled: true,
    description: 'Nur bestimmte Wochentage erlaubt (params: { weekdays: OnCampusDay["weekday"][] })',
  },
  ALLOWED_PHASE: {
    id: 'ALLOWED_PHASE',
    category: 'hard' as const,
    weight: 1,
    enabled: true,
    description: 'Nur bestimmte Phasen erlaubt (params: { phases: ("main"|"final")[] })',
  },
  FIXED_DAY: {
    id: 'FIXED_DAY',
    category: 'hard' as const,
    weight: 1,
    enabled: true,
    description: 'Modul fix auf Datum gelegt (params: { dates: string[] })',
  },
  WEEKLY_BALANCE: {
    id: 'WEEKLY_BALANCE',
    category: 'hard' as const,
    weight: 1,
    enabled: true,
    description: 'Wochenbalance: min/max Module pro Kalenderwoche',
  },

  // --- Soft: erzeugen softPenalties (gewichtete Präferenzen)
  AVOID_FRIDAY_AFTERNOON: {
    id: 'AVOID_FRIDAY_AFTERNOON',
    category: 'soft' as const,
    weight: 20,
    enabled: true,
    description: 'Freitag Nachmittag meiden',
  },
  AVOID_SATURDAY: {
    id: 'AVOID_SATURDAY',
    category: 'soft' as const,
    weight: 10,
    enabled: true,
    description: 'Samstag meiden',
  },
  PREFER_MORNING: {
    id: 'PREFER_MORNING',
    category: 'soft' as const,
    weight: 5,
    enabled: true,
    description: 'Vormittag bevorzugen (params gewichtet)',
  },
  AVOID_EVENING: {
    id: 'AVOID_EVENING',
    category: 'soft' as const,
    weight: 15,
    enabled: true,
    description: 'Abend-Slot meiden',
  },
  MINIMIZE_STUDENT_GAPS: {
    id: 'MINIMIZE_STUDENT_GAPS',
    category: 'soft' as const,
    weight: 5,
    enabled: false,
    description: 'Lücken im Stundenplan minimieren (platzhalter, braucht Kohortenmodell)',
  },
  PREFER_EARLY_DATES: {
    id: 'PREFER_EARLY_DATES',
    category: 'soft' as const,
    weight: 1,
    enabled: true,
    description: 'Frühe Termine leicht bevorzugen (tie-breaker)',
  },
} as const satisfies Record<string, ConstraintDefinition>

export type ConstraintId = keyof typeof CONSTRAINT_CATALOG

/** Hilfen: Gewicht auflösen (Restriction.weight überschreibt Katalog falls gesetzt) */
export function resolveWeight(id: string, override?: number): number {
  const entry = (CONSTRAINT_CATALOG as Record<string, ConstraintDefinition>)[id]
  if (override !== undefined) return override
  return entry?.weight ?? 1
}

export function isHard(id: string): boolean {
  const entry = (CONSTRAINT_CATALOG as Record<string, ConstraintDefinition>)[id]
  return entry?.category === 'hard'
}

export function getConstraint(id: string): ConstraintDefinition | undefined {
  return (CONSTRAINT_CATALOG as Record<string, ConstraintDefinition>)[id]
}
