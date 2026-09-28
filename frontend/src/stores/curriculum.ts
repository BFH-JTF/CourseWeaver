import { defineStore } from 'pinia'
import { ref } from 'vue'
import { usePostgres, EntityTables } from '@/composables/usePostgres'
import type { Department, Program, Degree, Module, ModuleConstraint } from '@/types/curriculum'
import type { MatrixCompetency } from '@/types/matrixCompetency'
import type { CompetencyMatrix } from '@/types/competencyMatrix'

export type { Department, Program, Degree, Module, ModuleConstraint }

export interface CurriculumVersion {
  _id?: string
  id?: string
  name: string
  description?: string
  versionNumber: number
  /** @deprecated Use versionNumber instead */
  version?: number
  programId?: string
  createdAt?: string
}

export interface Semester {
  _id?: string
  id?: string
  name?: string
  code?: string
  startDate: string
  endDate: string
}

export interface Lecturer {
  _id?: string
  id?: string
  name: string
  userId?: string
  departmentId?: string
  moduleIds?: string[]
}

export interface TaxonomyItem {
  _id?: string
  id?: string
  name: string
  description?: string
  category: 'competency' | 'learningObjective' | 'proofOfCompetency'
}

export const useCurriculumStore = defineStore('curriculum', () => {
  const { fetchEntities } = usePostgres()

  const curriculumVersions = ref<CurriculumVersion[]>([])
  const departments = ref<Department[]>([])
  const programs = ref<Program[]>([])
  const degrees = ref<Degree[]>([])
  const modules = ref<Module[]>([])
  const semesters = ref<Semester[]>([])
  const lecturers = ref<Lecturer[]>([])
  const taxonomyItems = ref<TaxonomyItem[]>([])
  const competencyMatrices = ref<CompetencyMatrix[]>([])
  const matrixCompetencies = ref<MatrixCompetency[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchDepartments() {
    loading.value = true
    error.value = null
    try {
      departments.value = await fetchEntities<Department>(EntityTables.DEPARTMENT)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function fetchPrograms() {
    loading.value = true
    error.value = null
    try {
      programs.value = await fetchEntities<Program>(EntityTables.PROGRAM)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function fetchDegrees() {
    loading.value = true
    error.value = null
    try {
      degrees.value = await fetchEntities<Degree>(EntityTables.DEGREE)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function fetchCurriculumVersions() {
    loading.value = true
    error.value = null
    try {
      curriculumVersions.value = await fetchEntities<CurriculumVersion>(EntityTables.CURRICULUM_VERSION)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function fetchModules() {
    loading.value = true
    error.value = null
    try {
      modules.value = await fetchEntities<Module>(EntityTables.MODULE)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function fetchSemesters() {
    loading.value = true
    error.value = null
    try {
      semesters.value = await fetchEntities<Semester>(EntityTables.SEMESTER)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function fetchLecturers() {
    loading.value = true
    error.value = null
    try {
      lecturers.value = await fetchEntities<Lecturer>(EntityTables.LECTURER)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function fetchTaxonomyItems() {
    loading.value = true
    error.value = null
    try {
      taxonomyItems.value = await fetchEntities<TaxonomyItem>(EntityTables.TAXONOMY)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function fetchCompetencyMatrices() {
    loading.value = true
    error.value = null
    try {
      competencyMatrices.value = await fetchEntities<CompetencyMatrix>(EntityTables.COMPETENCY_MATRIX)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function fetchMatrixCompetencies() {
    loading.value = true
    error.value = null
    try {
      matrixCompetencies.value = await fetchEntities<MatrixCompetency>(EntityTables.MATRIX_COMPETENCY)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  return {
    curriculumVersions,
    departments,
    programs,
    degrees,
    modules,
    semesters,
    lecturers,
    taxonomyItems,
    competencyMatrices,
    matrixCompetencies,
    loading,
    error,
    fetchCurriculumVersions,
    fetchDepartments,
    fetchPrograms,
    fetchDegrees,
    fetchModules,
    fetchSemesters,
    fetchLecturers,
    fetchTaxonomyItems,
    fetchCompetencyMatrices,
    fetchMatrixCompetencies,
  }
})
