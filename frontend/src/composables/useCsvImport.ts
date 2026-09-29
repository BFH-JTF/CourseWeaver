import { ref } from 'vue'
import { usePostgres, EntityTables } from '@/composables/usePostgres'
import type { ImportType } from '@/types/csvImport'

export function useCsvImport() {
  const { createEntity } = usePostgres()
  const isImporting = ref(false)
  const importError = ref<string | null>(null)

  const entityTableMap: Record<ImportType, string> = {
    competencies: EntityTables.COMPETENCY,
    modules: EntityTables.MODULE,
    learning_cycles: EntityTables.CURRICULUM_MODULE,
    study_programs: EntityTables.STUDY_PROGRAM,
    proofs_of_knowledge: EntityTables.PROOF_OF_COMPETENCY, // §3.2 Big Bang: importiert ins merge-Modell
    proofs_of_competency: EntityTables.PROOF_OF_COMPETENCY,
    departments: EntityTables.DEPARTMENT,
    programs: EntityTables.PROGRAM,
    degrees: EntityTables.DEGREE,
    matrix_competencies: EntityTables.MATRIX_COMPETENCY,
  }

  async function saveImportedData(type: ImportType, items: any[]): Promise<number> {
    isImporting.value = true
    importError.value = null
    const tableName = entityTableMap[type]

    try {
      let count = 0
      for (const item of items) {
        await createEntity(tableName, item)
        count++
      }
      return count
    } catch (e: any) {
      importError.value = e.message || 'Failed to save imported records'
      throw e
    } finally {
      isImporting.value = false
    }
  }

  return {
    isImporting,
    importError,
    saveImportedData,
  }
}
