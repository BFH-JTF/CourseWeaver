<template>
  <v-dialog
    :model-value="modelValue"
    max-width="560"
    scrollable
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-item class="bg-primary text-white py-3">
        <v-card-title class="text-h6">
          {{ isEdit ? 'Edit Proof of Knowledge' : 'New Proof of Knowledge' }}
        </v-card-title>
      </v-card-item>

      <v-card-text class="pa-4">
        <v-form ref="formRef" @submit.prevent="submit">
          <v-text-field
            v-model="proof.name"
            label="Name"
            :rules="[v => !!v || 'Name is required']"
            required
          />
          <v-select
            v-model="proof.assessmentType"
            :items="assessmentTypeOptions"
            label="Format (written / oral)"
          />
          <v-row dense>
            <v-col cols="12" md="6">
              <v-select
                v-model="proof.assignmentScope"
                :items="assignmentScopeOptions"
                label="Assignment (individual / group)"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model.number="proof.durationMinutes"
                label="Duration (minutes)"
                type="number"
                min="0"
                clearable
              />
            </v-col>
          </v-row>
          <div class="d-flex ga-4 mb-2">
            <v-checkbox v-model="proof.multipleChoice" label="Multiple Choice" density="compact" hide-details />
            <v-checkbox v-model="proof.freeText" label="Free Text" density="compact" hide-details />
          </div>
          <v-textarea
            v-model="proof.description"
            label="Description"
            rows="3"
            auto-grow
          />
        </v-form>
      </v-card-text>

      <v-divider />
      <v-card-actions class="pa-4">
        <v-spacer />
        <v-btn variant="text" @click="emit('update:modelValue', false)">Cancel</v-btn>
        <v-btn color="primary" variant="flat" @click="submit">
          {{ isEdit ? 'Save' : 'Create' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { ProofOfKnowledge } from '@/types/proofOfKnowledge'

const props = defineProps<{
  modelValue: boolean
  proofData?: ProofOfKnowledge
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'save': [proof: ProofOfKnowledge]
}>()

const isEdit = computed(() => !!props.proofData?.id)

const formRef = ref()
const proof = ref<ProofOfKnowledge>(emptyProof())

const assessmentTypeOptions = [
  { title: 'Written', value: 'written' },
  { title: 'Oral', value: 'oral' },
]

const assignmentScopeOptions = [
  { title: 'Individual', value: 'individual' },
  { title: 'Group', value: 'group' },
]

function emptyProof(): ProofOfKnowledge {
  return {
    name: '',
    assessmentType: 'written',
    assignmentScope: 'individual',
  }
}

watch(() => props.modelValue, (val) => {
  if (val) {
    proof.value = props.proofData
      ? JSON.parse(JSON.stringify(props.proofData))
      : emptyProof()
  }
})

async function submit() {
  const { valid } = await formRef.value?.validate() ?? { valid: false }
  if (!valid) return
  emit('save', JSON.parse(JSON.stringify(proof.value)))
  emit('update:modelValue', false)
}
</script>
