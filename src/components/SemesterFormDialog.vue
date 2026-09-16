<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="500" persistent>
    <v-card>
      <v-card-item class="bg-primary text-white py-3">
        <template #prepend>
          <v-icon icon="mdi-school-outline" size="large" class="me-2" />
        </template>
        <v-card-title class="text-h6 font-weight-medium">{{ isEdit ? 'Edit Semester' : 'Add Semester' }}</v-card-title>
        <v-card-subtitle class="text-white text-opacity-80">
          Define a semester period for scheduling
        </v-card-subtitle>
        <template #append>
          <v-btn icon="mdi-close" variant="text" density="comfortable" @click="close" />
        </template>
      </v-card-item>

      <v-card-text class="pa-4 pa-sm-6">
        <v-form ref="formRef" @submit.prevent="submit">
          <v-text-field
            v-model="form.identifier"
            label="Identifier *"
            variant="outlined"
            density="compact"
            :rules="[v => !!v || 'Identifier is required']"
            placeholder="e.g. HS2026, FS2027"
            class="mb-3"
          />

          <v-text-field
            v-model="form.startDate"
            label="Start Date *"
            type="date"
            variant="outlined"
            density="compact"
            :rules="[v => !!v || 'Start date is required']"
            class="mb-3"
          />

          <v-text-field
            v-model="form.endDate"
            label="End Date *"
            type="date"
            variant="outlined"
            density="compact"
            :rules="[v => !!v || 'End date is required', v => !form.startDate || v >= form.startDate || 'End date must be after start date']"
            class="mb-3"
          />

          <div v-if="form.holidays && form.holidays.length" class="mb-3">
            <h3 class="text-subtitle-2 font-weight-bold mb-2">Holidays</h3>
            <div v-for="(holiday, idx) in form.holidays" :key="idx" class="d-flex align-center ga-2 mb-2">
              <v-text-field
                v-model="holiday.start"
                label="Start"
                type="date"
                variant="outlined"
                density="compact"
                hide-details
                style="max-width: 160px"
              />
              <v-text-field
                v-model="holiday.end"
                label="End"
                type="date"
                variant="outlined"
                density="compact"
                hide-details
                style="max-width: 160px"
              />
              <v-text-field
                v-model="holiday.label"
                label="Label"
                variant="outlined"
                density="compact"
                hide-details
                placeholder="Optional"
                class="flex-grow-1"
              />
              <v-btn icon variant="text" size="small" color="error" @click="form.holidays!.splice(idx, 1)">
                <v-icon>mdi-delete</v-icon>
              </v-btn>
            </div>
          </div>
          <v-btn variant="tonal" prepend-icon="mdi-plus" size="small" @click="addHoliday">
            Add Holiday
          </v-btn>

          <v-divider class="my-4" />

          <div v-if="form.specialDates && form.specialDates.length" class="mb-3">
            <h3 class="text-subtitle-2 font-weight-bold mb-2">Special Dates</h3>
            <div v-for="(sd, idx) in form.specialDates" :key="idx" class="d-flex align-center ga-2 mb-2">
              <v-text-field
                v-model="sd.start"
                label="Start"
                type="date"
                variant="outlined"
                density="compact"
                hide-details
                style="max-width: 160px"
              />
              <v-text-field
                v-model="sd.end"
                label="End"
                type="date"
                variant="outlined"
                density="compact"
                hide-details
                style="max-width: 160px"
              />
              <v-text-field
                v-model="sd.label"
                label="Label"
                variant="outlined"
                density="compact"
                hide-details
                placeholder="Optional"
                class="flex-grow-1"
              />
              <v-btn icon variant="text" size="small" color="error" @click="form.specialDates!.splice(idx, 1)">
                <v-icon>mdi-delete</v-icon>
              </v-btn>
            </div>
          </div>
          <v-btn variant="tonal" prepend-icon="mdi-plus" size="small" @click="addSpecialDate">
            Add Special Date
          </v-btn>
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
import type { Semester } from '@/stores/curriculum'
import { emptySemester } from '@/composables/useSemesters'

const props = defineProps<{
  modelValue: boolean
  semesterData: Semester | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'save', payload: Semester): void
}>()

const isEdit = computed(() => !!props.semesterData?._id || !!props.semesterData?.id)

const form = ref<Semester>(JSON.parse(JSON.stringify(emptySemester)))
const formRef = ref()

watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    if (props.semesterData) {
      form.value = JSON.parse(JSON.stringify(props.semesterData))
    } else {
      form.value = JSON.parse(JSON.stringify(emptySemester))
    }
  }
})

function addHoliday() {
  if (!form.value.holidays) form.value.holidays = []
  form.value.holidays.push({ start: '', end: '', label: '' })
}

function addSpecialDate() {
  if (!form.value.specialDates) form.value.specialDates = []
  form.value.specialDates.push({ start: '', end: '', label: '' })
}

function close() {
  emit('update:modelValue', false)
}

function submit() {
  emit('save', JSON.parse(JSON.stringify(form.value)))
  close()
}
</script>