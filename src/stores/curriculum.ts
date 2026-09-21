import { defineStore } from 'pinia'
import { ref } from 'vue'
import { usePostgres, EntityTables } from '@/composables/usePostgres'
import type { Room } from '@/types/room'
import type { Location } from '@/types/location'
import type { Department, Program, Degree, Module, ModuleConstraint } from '@/types/curriculum'
import type { LecturerAvailability, SchedulingRule } from '@/types/schedule'
import type { MatrixCompetency } from '@/types/matrixCompetency'
import type { RoomAvailability } from '@/types/roomAvailability'
import type { WeekLecture } from '@/types/weekLecture'
import type { SemesterSchedule } from '@/types/semesterSchedule'

export type { Department, Program, Degree, Module, ModuleConstraint }
export type { LecturerAvailability, SchedulingRule }

export interface CurriculumVersion {
  _id?: string
  id?: string
  name: string
  description?: string
  versionNumber: number
  /** @deprecated Use versionNumber instead */
  version?: number
  programId?: string
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
  departmentIDs?: string[]
  departmentIds?: string[]
  contact?: string
  url?: string
  /** @deprecated Use url instead */
  URL?: string
}

export interface Semester {
  _id?: string
  id?: string
  name?: string
  /** @deprecated Use name instead */
  identifier?: string
  code?: string
  startDate: string
  endDate: string
  daysOff?: string[]
  /** @deprecated Use daysOff instead */
  holidays?: DateRange[]
  specialDates?: DateRange[]
  curriculumVersionId?: string
  schedulingRulesId?: string
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
  proofOfCompetencyIds?: string[]
  /** @deprecated Use proofOfCompetencyIds instead */
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
  userId?: string
  email?: string
  department?: string
  moduleIds?: string[]
  /** @deprecated Use flat LecturerAvailability entities instead */
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
  category: 'competency' | 'learningObjective' | 'proofOfCompetency'
  /** @deprecated Use 'proofOfCompetency' instead */
  parentTaxonomyItemId?: string
}

export const useCurriculumStore = defineStore('curriculum', () => {
  const { fetchEntities } = usePostgres()

  const curriculumVersions = ref<CurriculumVersion[]>([])
  const studyPrograms = ref<StudyProgram[]>([])
  const departments = ref<Department[]>([])
  const programs = ref<Program[]>([])
  const degrees = ref<Degree[]>([])
  const modules = ref<Module[]>([])
  const semesters = ref<Semester[]>([])
  const lessons = ref<Lesson[]>([])
  const rooms = ref<Room[]>([])
  const locations = ref<Location[]>([])
  const lecturers = ref<Lecturer[]>([])
  const lecturerAvailabilities = ref<LecturerAvailability[]>([])
  const schedulingRules = ref<SchedulingRule[]>([])
  const taxonomyItems = ref<TaxonomyItem[]>([])
  const matrixCompetencies = ref<MatrixCompetency[]>([])
  const roomAvailabilities = ref<RoomAvailability[]>([])
  const weekLectures = ref<WeekLecture[]>([])
  const semesterSchedules = ref<SemesterSchedule[]>([])
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

  async function fetchLecturerAvailabilities() {
    loading.value = true
    error.value = null
    try {
      lecturerAvailabilities.value = await fetchEntities<LecturerAvailability>(EntityTables.LECTURER_AVAILABILITY)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function fetchSchedulingRules() {
    loading.value = true
    error.value = null
    try {
      schedulingRules.value = await fetchEntities<SchedulingRule>(EntityTables.SCHEDULING_RULE)
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

  async function fetchRoomAvailabilities() {
    loading.value = true
    error.value = null
    try {
      roomAvailabilities.value = await fetchEntities<RoomAvailability>(EntityTables.ROOM_AVAILABILITY)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function fetchWeekLectures() {
    loading.value = true
    error.value = null
    try {
      weekLectures.value = await fetchEntities<WeekLecture>(EntityTables.WEEK_LECTURE)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function fetchSemesterSchedules() {
    loading.value = true
    error.value = null
    try {
      semesterSchedules.value = await fetchEntities<SemesterSchedule>(EntityTables.SEMESTER_SCHEDULE)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  return {
    curriculumVersions,
    studyPrograms,
    departments,
    programs,
    degrees,
    modules,
    semesters,
    lessons,
    rooms,
    locations,
    lecturers,
    lecturerAvailabilities,
    schedulingRules,
    taxonomyItems,
    matrixCompetencies,
    roomAvailabilities,
    weekLectures,
    semesterSchedules,
    loading,
    error,
    fetchCurriculumVersions,
    fetchStudyPrograms,
    fetchDepartments,
    fetchPrograms,
    fetchDegrees,
    fetchModules,
    fetchSemesters,
    fetchLessons,
    fetchRooms,
    fetchLocations,
    fetchLecturers,
    fetchLecturerAvailabilities,
    fetchSchedulingRules,
    fetchTaxonomyItems,
    fetchMatrixCompetencies,
    fetchRoomAvailabilities,
    fetchWeekLectures,
    fetchSemesterSchedules,
  }
})