export interface Department {
  id?: string
  _id?: string
  name: string
  description?: string
  contact?: string
  url?: string
  URL?: string
}

export type DepartmentExport = Department[]

export interface Program {
  id?: string
  _id?: string
  name: string
  description?: string
  departmentIDs?: string[]
  departmentIds?: string[]
  contact?: string
  url?: string
  URL?: string
}

export type ProgramExport = Program[]

export interface Degree {
  id?: string
  _id?: string
  name: string
  description?: string
  ProgramIDs?: string[]
  programIDs?: string[]
  programIds?: string[]
  contact?: string
  url?: string
  URL?: string
}

export type DegreeExport = Degree[]

export interface ModuleConstraint {
  type: 'requires' | 'corequisite' | 'forbids'
  targetModuleId: string
}

export interface Module {
  id?: string
  _id?: string
  name: string
  description?: string
  DegreeIDs?: string[]
  degreeIDs?: string[]
  degreeIds?: string[]
  contact?: string
  url?: string
  URL?: string
  code?: string
  creditPoints?: number
  contactHours?: number
  selfStudyHours?: number
  teachingHours?: number
  constraints?: ModuleConstraint[]
  curriculumVersionId?: string
  studyProgramIds?: string[]
}

export type ModuleExport = Module[]
