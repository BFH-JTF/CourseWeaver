import { useProofsOfCompetency } from '@/composables/useProofsOfCompetency'

/** @deprecated Use useProofsOfCompetency instead */
export function useProofsOfKnowledge() {
  const comp = useProofsOfCompetency()
  return {
    ...comp,
    proofsOfKnowledge: comp.proofsOfCompetency,
    fetchProofsOfKnowledge: comp.fetchProofsOfCompetency,
    addProofOfKnowledge: comp.addProofOfCompetency,
    updateProofOfKnowledge: comp.updateProofOfCompetency,
    removeProofOfKnowledge: comp.removeProofOfCompetency,
    importProofsOfKnowledge: comp.importProofsOfCompetency,
    emptyProofOfKnowledge: comp.emptyProofOfCompetency,
  }
}
