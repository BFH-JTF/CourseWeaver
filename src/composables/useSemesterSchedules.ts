import { ref } from 'vue'
import { usePostgres, EntityTables } from '@/composables/usePostgres'
import type { SemesterSchedule } from '@/types/semesterSchedule'

function emptySemesterSchedule(): SemesterSchedule {
  return {
    semesterId: '',
  }
}

export function useSemesterSchedules() {
  const { fetchEntities, createEntity, updateEntity: updateDbEntity, removeEntity: removeDbEntity } = usePostgres()
  const semesterSchedules = ref<SemesterSchedule[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

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

  async function addSemesterSchedule(item: SemesterSchedule) {
    error.value = null
    try {
      const saved = await createEntity<SemesterSchedule>(EntityTables.SEMESTER_SCHEDULE, item)
      item.id = saved.id
      semesterSchedules.value = await fetchEntities<SemesterSchedule>(EntityTables.SEMESTER_SCHEDULE)
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function updateSemesterSchedule(item: SemesterSchedule) {
    const id = item.id
    if (!id) return
    error.value = null
    try {
      await updateDbEntity(EntityTables.SEMESTER_SCHEDULE, id, item)
      const idx = semesterSchedules.value.findIndex(s => s.id === id)
      if (idx !== -1) semesterSchedules.value[idx] = item
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function removeSemesterSchedule(id: string) {
    error.value = null
    try {
      await removeDbEntity(EntityTables.SEMESTER_SCHEDULE, id)
      semesterSchedules.value = semesterSchedules.value.filter(s => s.id !== id)
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  return {
    semesterSchedules,
    loading,
    error,
    fetchSemesterSchedules,
    addSemesterSchedule,
    updateSemesterSchedule,
    removeSemesterSchedule,
    emptySemesterSchedule,
  }
}