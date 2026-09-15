import { ref } from 'vue'
import { usePostgres, EntityTables } from '@/composables/usePostgres'
import type { ProofOfKnowledge } from '@/types/proofOfKnowledge'

function emptyProofOfKnowledge(): ProofOfKnowledge {
  return {
    name: '',
    description: '',
    assessmentType: 'written',
    multipleChoice: false,
    freeText: false,
    assignmentScope: 'individual',
    durationMinutes: undefined,
  }
}

export function useProofsOfKnowledge() {
  const { fetchEntities, createEntity, updateEntity: updateDbEntity, removeEntity: removeDbEntity } = usePostgres()
  const proofsOfKnowledge = ref<ProofOfKnowledge[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchProofsOfKnowledge() {
    loading.value = true
    error.value = null
    try {
      proofsOfKnowledge.value = await fetchEntities<ProofOfKnowledge>(EntityTables.PROOF_OF_KNOWLEDGE)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function addProofOfKnowledge(proof: ProofOfKnowledge) {
    error.value = null
    try {
      const saved = await createEntity<ProofOfKnowledge>(EntityTables.PROOF_OF_KNOWLEDGE, proof)
      proof.id = saved.id
      proofsOfKnowledge.value = await fetchEntities<ProofOfKnowledge>(EntityTables.PROOF_OF_KNOWLEDGE)
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function updateProofOfKnowledge(proof: ProofOfKnowledge) {
    const id = proof.id
    if (!id) return
    error.value = null
    try {
      await updateDbEntity(EntityTables.PROOF_OF_KNOWLEDGE, id, proof)
      const idx = proofsOfKnowledge.value.findIndex(p => p.id === id)
      if (idx !== -1) proofsOfKnowledge.value[idx] = proof
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function removeProofOfKnowledge(id: string) {
    error.value = null
    try {
      await removeDbEntity(EntityTables.PROOF_OF_KNOWLEDGE, id)
      proofsOfKnowledge.value = proofsOfKnowledge.value.filter(p => p.id !== id)
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function importProofsOfKnowledge(items: ProofOfKnowledge[]): Promise<ProofOfKnowledge[]> {
    error.value = null
    const imported: ProofOfKnowledge[] = []
    try {
      for (const item of items) {
        const saved = await createEntity<ProofOfKnowledge>(EntityTables.PROOF_OF_KNOWLEDGE, item)
        item.id = saved.id
        imported.push(item)
      }
      proofsOfKnowledge.value = await fetchEntities<ProofOfKnowledge>(EntityTables.PROOF_OF_KNOWLEDGE)
      return imported
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  return {
    proofsOfKnowledge,
    loading,
    error,
    fetchProofsOfKnowledge,
    addProofOfKnowledge,
    updateProofOfKnowledge,
    removeProofOfKnowledge,
    importProofsOfKnowledge,
    emptyProofOfKnowledge,
  }
}
