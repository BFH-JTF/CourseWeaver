import { defineStore } from 'pinia'
import { ref } from 'vue'
import { usePostgres, EntityTables } from '@/composables/usePostgres'
import type { Room } from '@/types/room'
import type { Location } from '@/types/location'

export interface CurriculumVersion {
  _id?: string
  id?: string
  name: string
  description?: string
  version: number
  parentId?: string
  createdAt?: string
}

export interface StudyProgram {
  _id?: string
  id?: string
  name: string
  description?: string
  degreeType?: string
  version?: number
  curriculumVersionId?: string
}

export interface Module {
  _id?: string
  id?: string
  name: string
  description?: string
  code?: string
  creditPoints?: number
  contactHours?: number
  selfStudyHours?: number
  teachingHours?: number
  constraints?: ModuleConstraint[]
  curriculumVersionId?: string
  studyProgramIds?: string[]
}

export interface ModuleConstraint {
  type: 'requires' | 'corequisite' | 'forbids'
  targetModuleId: string
}

export interface Semester {
  _id?: string
  id?: string
  identifier: string
  startDate: string
  endDate: string
  holidays?: DateRange[]
  specialDates?: DateRange[]
}

export interface DateRange {
  start: string
  end: string
  label?: string
}

export interface Lesson {
  _id?: string
  id?: string
  moduleId: string
  name: string
  description?: string
  taxonomyItemIds?: string[]
  proofOfKnowledgeIds?: string[]
  scheduledSessions?: ScheduledSession[]
}

export interface ScheduledSession {
  date: string
  startTime: string
  endTime: string
  lecturerId?: string
  roomId?: string
}

export interface Lecturer {
  _id?: string
  id?: string
  name: string
  email?: string
  department?: string
  availability?: AvailabilitySlot[]
}

export interface AvailabilitySlot {
  dayOfWeek: number
  startTime: string
  endTime: string
}

export interface TaxonomyItem {
  _id?: string
  id?: string
  name: string
  description?: string
  category: 'competency' | 'learningObjective' | 'proofOfKnowledge'
  parentTaxonomyItemId?: string
}

// Entity mapping for Postgres JSONB backend
const DocType = EntityTables

export { DocType }

export const useCurriculumStore = defineStore('curriculum', () => {
  const { fetchEntities } = usePostgres()

  const curriculumVersions = ref<CurriculumVersion[]>([])
  const studyPrograms = ref<StudyProgram[]>([])
  const modules = ref<Module[]>([])
  const semesters = ref<Semester[]>([])
  const lessons = ref<Lesson[]>([])
  const rooms = ref<Room[]>([])
  const locations = ref<Location[]>([])
  const lecturers = ref<Lecturer[]>([])
  const taxonomyItems = ref<TaxonomyItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

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

  async function fetchStudyPrograms() {
    loading.value = true
    error.value = null
    try {
      studyPrograms.value = await fetchEntities<StudyProgram>(EntityTables.STUDY_PROGRAM)
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

  async function fetchLessons() {
    loading.value = true
    error.value = null
    try {
      lessons.value = await fetchEntities<Lesson>(EntityTables.LESSON)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function fetchRooms() {
    loading.value = true
    error.value = null
    try {
      rooms.value = await fetchEntities<Room>(EntityTables.ROOM)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function fetchLocations() {
    loading.value = true
    error.value = null
    try {
      locations.value = await fetchEntities<Location>(EntityTables.LOCATION)
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

  return {
    curriculumVersions,
    studyPrograms,
    modules,
    semesters,
    lessons,
    rooms,
    locations,
    lecturers,
    taxonomyItems,
    loading,
    error,
    fetchCurriculumVersions,
    fetchStudyPrograms,
    fetchModules,
    fetchSemesters,
    fetchLessons,
    fetchRooms,
    fetchLocations,
    fetchLecturers,
    fetchTaxonomyItems,
  }
})