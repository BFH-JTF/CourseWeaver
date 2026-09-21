import { ref } from 'vue'
import { usePostgres, EntityTables } from '@/composables/usePostgres'
import type { WeekLecture } from '@/types/weekLecture'

function emptyWeekLecture(): WeekLecture {
  return {
    moduleIds: [],
    roomId: '',
    weekday: 'monday',
    startTime: '08:00',
    endTime: '12:00',
  }
}

export function useWeekLectures() {
  const { fetchEntities, createEntity, updateEntity: updateDbEntity, removeEntity: removeDbEntity } = usePostgres()
  const weekLectures = ref<WeekLecture[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

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

  async function addWeekLecture(item: WeekLecture) {
    error.value = null
    try {
      const saved = await createEntity<WeekLecture>(EntityTables.WEEK_LECTURE, item)
      item.id = saved.id
      weekLectures.value = await fetchEntities<WeekLecture>(EntityTables.WEEK_LECTURE)
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function updateWeekLecture(item: WeekLecture) {
    const id = item.id
    if (!id) return
    error.value = null
    try {
      await updateDbEntity(EntityTables.WEEK_LECTURE, id, item)
      const idx = weekLectures.value.findIndex(w => w.id === id)
      if (idx !== -1) weekLectures.value[idx] = item
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function removeWeekLecture(id: string) {
    error.value = null
    try {
      await removeDbEntity(EntityTables.WEEK_LECTURE, id)
      weekLectures.value = weekLectures.value.filter(w => w.id !== id)
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function importWeekLectures(items: WeekLecture[]): Promise<WeekLecture[]> {
    error.value = null
    const imported: WeekLecture[] = []
    try {
      for (const item of items) {
        const saved = await createEntity<WeekLecture>(EntityTables.WEEK_LECTURE, item)
        item.id = saved.id
        imported.push(item)
      }
      weekLectures.value = await fetchEntities<WeekLecture>(EntityTables.WEEK_LECTURE)
      return imported
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  return {
    weekLectures,
    loading,
    error,
    fetchWeekLectures,
    addWeekLecture,
    updateWeekLecture,
    removeWeekLecture,
    importWeekLectures,
    emptyWeekLecture,
  }
}