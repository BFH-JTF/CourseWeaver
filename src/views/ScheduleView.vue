<template>
  <v-container>
    <h1>Schedule Creation</h1>
    <p class="text-body-1 mt-2 mb-4">
      Create and manage semester schedules. Define time frames, assign lecturers and rooms to sessions.
    </p>
    <v-alert type="info" variant="tonal" class="mb-4">
      Scheduling features are coming soon. This view will allow you to create timetables, set module constraints
      (block weeks, weekly/biweekly), and manage semester dates.
    </v-alert>
    <v-row>
      <v-col cols="12" md="6">
        <v-card>
          <v-card-title>Semesters</v-card-title>
          <v-card-text>
            <v-list>
              <v-list-item v-for="s in semesters" :key="s._id" :title="s.identifier" :subtitle="`${s.startDate} – ${s.endDate}`" />
              <v-list-item v-if="semesters.length === 0" title="No semesters defined yet" />
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="6">
        <v-card>
          <v-card-title>Lecturers</v-card-title>
          <v-card-text>
            <v-list>
              <v-list-item v-for="l in lecturers" :key="l._id" :title="l.name" :subtitle="l.department" />
              <v-list-item v-if="lecturers.length === 0" title="No lecturers defined yet" />
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useCurriculumStore } from '@/stores/curriculum'

const store = useCurriculumStore()
const { semesters, lecturers } = storeToRefs(store)

onMounted(() => {
  store.fetchSemesters()
  store.fetchLecturers()
})
</script>