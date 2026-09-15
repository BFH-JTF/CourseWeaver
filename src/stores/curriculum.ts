import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useDocPouch } from '@/composables/useDocPouch'
import type { Room } from '@/types/room'
import type { Location } from '@/types/location'

export interface CurriculumVersion {
  _id?: string
  name: string
  description?: string
  version: number
  parentId?: string
  createdAt?: string
}

export interface StudyProgram {
  _id?: string
  name: string
  description?: string
  degreeType?: string
  version?: number
  curriculumVersionId?: string
}

export interface Module {
  _id?: string
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
  name: string
  description?: string
  category: 'competency' | 'learningObjective' | 'proofOfKnowledge'
  parentTaxonomyItemId?: string
}

const DocType = {
  CURRICULUM_VERSION: { type: 100, subType: 1 },
  STUDY_PROGRAM: { type: 100, subType: 2 },
  MODULE: { type: 100, subType: 3 },
  SEMESTER: { type: 100, subType: 4 },
  LESSON: { type: 100, subType: 5 },
  ROOM: { type: 101, subType: 1 },
  LOCATION: { type: 101, subType: 3 },
  LECTURER: { type: 101, subType: 2 },
  TAXONOMY: { type: 102, subType: 1 },
} as const

export { DocType }

export const useCurriculumStore = defineStore('curriculum', () => {
  const { client } = useDocPouch()

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

  async function fetchDocuments<T>(docType: { type: number; subType: number }): Promise<T[]> {
    if (!client.value) return []
    const docs = await client.value.fetchDocuments({ type: docType.type, subType: docType.subType } as any)
    return docs.map(d => d.content?.structuredData ?? d.content ?? d) as T[]
  }

  async function fetchCurriculumVersions() {
    loading.value = true
    error.value = null
    try {
      curriculumVersions.value = await fetchDocuments<CurriculumVersion>(DocType.CURRICULUM_VERSION)
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
      studyPrograms.value = await fetchDocuments<StudyProgram>(DocType.STUDY_PROGRAM)
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
      modules.value = await fetchDocuments<Module>(DocType.MODULE)
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
      semesters.value = await fetchDocuments<Semester>(DocType.SEMESTER)
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
      lessons.value = await fetchDocuments<Lesson>(DocType.LESSON)
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
      rooms.value = await fetchDocuments<Room>(DocType.ROOM)
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
      locations.value = await fetchDocuments<Location>(DocType.LOCATION)
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
      lecturers.value = await fetchDocuments<Lecturer>(DocType.LECTURER)
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
      taxonomyItems.value = await fetchDocuments<TaxonomyItem>(DocType.TAXONOMY)
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