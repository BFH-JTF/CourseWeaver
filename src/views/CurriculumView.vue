<template>
  <v-container>
    <h1>Curriculum Mapping</h1>
    <p class="text-body-1 mt-2 mb-4">
      Import and manage study programs, degrees, modules, and lessons. Map taxonomy items to lessons and track curriculum versions.
    </p>
    <v-row>
      <v-col cols="12" md="6">
        <v-card>
          <v-card-title>Curriculum Versions</v-card-title>
          <v-card-text>
            <v-list>
              <v-list-item v-for="v in curriculumVersions" :key="v._id" :title="v.name">
                <template #append>
                  <v-chip size="small">v{{ v.version }}</v-chip>
                </template>
              </v-list-item>
              <v-list-item v-if="curriculumVersions.length === 0" title="No curriculum versions yet" />
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="6">
        <v-card>
          <v-card-title>Study Programs</v-card-title>
          <v-card-text>
            <v-list>
              <v-list-item v-for="sp in studyPrograms" :key="sp._id" :title="sp.name" :subtitle="sp.degreeType" />
              <v-list-item v-if="studyPrograms.length === 0" title="No study programs yet" />
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
const { curriculumVersions, studyPrograms } = storeToRefs(store)

onMounted(() => {
  store.fetchCurriculumVersions()
  store.fetchStudyPrograms()
})
</script>