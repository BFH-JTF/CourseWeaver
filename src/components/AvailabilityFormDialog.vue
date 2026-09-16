<template>
  <v-dialog :model-value="modelValue" max-width="800" scrollable persistent @update:model-value="$emit('update:modelValue', $event)">
    <v-card>
      <v-card-item class="bg-primary text-white py-3">
        <template #prepend>
          <v-icon icon="mdi-calendar-clock" size="large" class="me-2" />
        </template>
        <v-card-title class="text-h6 font-weight-medium">{{ isEdit ? 'Edit Availability' : 'Add Availability' }}</v-card-title>
        <v-card-subtitle class="text-white text-opacity-80">
          Define your weekly availability for teaching
        </v-card-subtitle>
        <template #append>
          <v-btn icon="mdi-close" variant="text" density="comfortable" @click="close" />
        </template>
      </v-card-item>

      <v-card-text class="pa-4 pa-sm-6">
        <v-form ref="formRef" @submit.prevent="submit">
          <p class="text-body-2 text-medium-emphasis mb-4">
            This availability applies to all weeks in the semester. Add the days and times you are available for teaching.
          </p>

          <div v-for="(slot, idx) in form.recurringAvailability" :key="idx" class="d-flex align-center ga-2 mb-2">
            <v-select
              v-model="slot.weekday"
              :items="weekdayItems"
              item-title="title"
              item-value="value"
              label="Day"
              variant="outlined"
              density="compact"
              hide-details
              style="max-width: 160px"
            />
            <v-text-field
              v-model="slot.startTime"
              label="Start"
              type="time"
              variant="outlined"
              density="compact"
              hide-details
              style="max-width: 140px"
            />
            <v-text-field
              v-model="slot.endTime"
              label="End"
              type="time"
              variant="outlined"
              density="compact"
              hide-details
              style="max-width: 140px"
            />
            <v-text-field
              v-model="slot.label"
              label="Label"
              variant="outlined"
              density="compact"
              hide-details
              placeholder="Optional"
              style="max-width: 160px"
            />
            <v-btn icon variant="text" size="small" color="error" @click="removeRecurringSlot(idx)">
              <v-icon>mdi-delete</v-icon>
            </v-btn>
          </div>

          <v-btn variant="tonal" prepend-icon="mdi-plus" size="small" @click="addRecurringSlot">
            Add Time Slot
          </v-btn>

          <v-alert v-if="form.recurringAvailability.length === 0" type="info" variant="tonal" class="mt-4" density="compact">
            Add at least one time slot to define when you are available.
          </v-alert>
        </v-form>
      </v-card-text>

      <v-divider />
      <v-card-actions class="pa-4">
        <v-spacer />
        <v-btn variant="text" @click="close">Cancel</v-btn>
        <v-btn color="primary" variant="flat" @click="submit">
          {{ isEdit ? 'Save' : 'Create' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { LecturerAvailability } from '@/types/schedule'
import { WEEKDAY_LABELS, WEEKDAY_OPTIONS } from '@/types/schedule'
import { emptyLecturerAvailability, emptyRecurringAvailability } from '@/composables/useAvailability'

const props = defineProps<{
  modelValue: boolean
  availabilityData: LecturerAvailability | null
  currentUserId: string
  currentSemesterId: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'save', payload: LecturerAvailability): void
}>()

const isEdit = computed(() => !!props.availabilityData?._id || !!props.availabilityData?.id)

const form = ref<LecturerAvailability>(JSON.parse(JSON.stringify(emptyLecturerAvailability)))

const formRef = ref()

const weekdayItems = WEEKDAY_OPTIONS.map(wd => ({ title: WEEKDAY_LABELS[wd], value: wd }))

watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    if (props.availabilityData) {
      form.value = JSON.parse(JSON.stringify(props.availabilityData))
    } else {
      form.value = {
        ...JSON.parse(JSON.stringify(emptyLecturerAvailability)),
        lecturerId: props.currentUserId,
        semesterId: props.currentSemesterId,
      }
    }
  }
})

function addRecurringSlot() {
  form.value.recurringAvailability.push({ ...emptyRecurringAvailability })
}

function removeRecurringSlot(idx: number) {
  form.value.recurringAvailability.splice(idx, 1)
}

function close() {
  emit('update:modelValue', false)
}

function submit() {
  if (!props.availabilityData?._id && !props.availabilityData?.id) {
    form.value.lecturerId = props.currentUserId
    form.value.semesterId = props.currentSemesterId
  }
  emit('save', JSON.parse(JSON.stringify(form.value)))
  close()
}
</script>