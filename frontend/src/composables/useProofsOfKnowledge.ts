/**
 * Proof of Knowledge CRUD — MINIMAL-STUB (siehe Hinweis in types/proofOfKnowledge.ts):
 *︀ Derselbe Aufbau wie useRooms/useLocations via usePostgres, Entity-Tabelle PROOF_OF_KNOWLEDGE.
 */
import { ref } from 'vue'
import { usePostgres, EntityTables } from '@/composables/usePostgres'
import type { ProofOfKnowledge } from '@/types/proofOfKnowledge'

export function useProofsOfKnowledge() {
  const { fetchEntities, createEntity, updateEntity, removeEntity } = usePostgres()

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
      await createEntity<ProofOfKnowledge>(EntityTables.PROOF_OF_KNOWLEDGE, proof)
      await fetchProofsOfKnowledge()
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function updateProofOfKnowledge(proof: ProofOfKnowledge) {
    error.value = null
    try {
      const id = proof.id ?? proof._id
      if (!id) throw new Error('ProofOfKnowledge ohne id — Update nicht möglich')
      await updateEntity(EntityTables.PROOF_OF_KNOWLEDGE, id, proof)
      await fetchProofsOfKnowledge()
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function removeProofOfKnowledge(id: string) {
    error.value = null
    try {
      await removeEntity(EntityTables.PROOF_OF_KNOWLEDGE, id)
      await fetchProofsOfKnowledge()
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
  }
}
