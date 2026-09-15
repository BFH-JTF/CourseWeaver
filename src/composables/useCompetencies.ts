import { ref } from 'vue'
import { usePostgres, EntityTables } from '@/composables/usePostgres'
import type { Competency } from '@/types/competency'

function emptyCompetency(): Competency {
  return {
    name: '',
    category: '',
    description: '',
    level: undefined,
  }
}

export function useCompetencies() {
  const { fetchEntities, createEntity, updateEntity: updateDbEntity, removeEntity: removeDbEntity } = usePostgres()
  const competencies = ref<Competency[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchCompetencies() {
    loading.value = true
    error.value = null
    try {
      competencies.value = await fetchEntities<Competency>(EntityTables.COMPETENCY)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function addCompetency(competency: Competency) {
    error.value = null
    try {
      const saved = await createEntity<Competency>(EntityTables.COMPETENCY, competency)
      competency.id = saved.id
      competencies.value = await fetchEntities<Competency>(EntityTables.COMPETENCY)
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function updateCompetency(competency: Competency) {
    const id = competency.id
    if (!id) return
    error.value = null
    try {
      await updateDbEntity(EntityTables.COMPETENCY, id, competency)
      const idx = competencies.value.findIndex(c => c.id === id)
      if (idx !== -1) competencies.value[idx] = competency
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function removeCompetency(id: string) {
    error.value = null
    try {
      await removeDbEntity(EntityTables.COMPETENCY, id)
      competencies.value = competencies.value.filter(c => c.id !== id)
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function importCsv(_text: string): Promise<Competency[]> {
    // Import logic does not exist yet and will be shared among several components.
    return []
  }

  return {
    competencies,
    loading,
    error,
    fetchCompetencies,
    addCompetency,
    updateCompetency,
    removeCompetency,
    importCsv,
    emptyCompetency,
  }
}
