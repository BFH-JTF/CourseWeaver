import type { Department, Program, Degree, Module } from '@/types/curriculum'

/**
 * Curriculum entities carry several historical spellings of the same field
 * (`url`/`URL`, `departmentIDs`/`departmentIds`, ...). Records are written to the
 * JSONB store with every alias in sync, so readers can pick whichever they expect.
 * `url` and the capitalised relation keys (`ProgramIDs`, `DegreeIDs`) are authoritative.
 */
function syncUrl<T extends { url?: string; URL?: string }>(entity: T): T {
  const url = entity.url ?? ''
  return { ...entity, url, URL: url }
}

export function normalizeDepartment(department: Department): Department {
  return syncUrl({ ...department })
}

export function normalizeProgram(program: Program): Program {
  const departmentIDs = program.departmentIDs ?? program.departmentIds ?? []
  return syncUrl({ ...program, departmentIDs, departmentIds: departmentIDs })
}

export function normalizeDegree(degree: Degree): Degree {
  const programIDs = degree.ProgramIDs ?? degree.programIDs ?? degree.programIds ?? []
  return syncUrl({ ...degree, ProgramIDs: programIDs, programIDs, programIds: programIDs })
}

export function normalizeModule(mod: Module): Module {
  const degreeIDs = mod.DegreeIDs ?? mod.degreeIDs ?? mod.degreeIds ?? []
  return syncUrl({ ...mod, DegreeIDs: degreeIDs, degreeIDs, degreeIds: degreeIDs })
}
