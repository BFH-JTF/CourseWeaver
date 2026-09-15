<template>
  <v-container>
    <div class="d-flex align-center justify-space-between mb-1">
      <h1>Curriculum Mapping</h1>
      <v-btn
        variant="outlined"
        prepend-icon="mdi-file-import"
        @click="csvImportDialogOpen = true"
      >
        Import CSV
      </v-btn>
    </div>
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

    <CsvImportDialog
      v-model="csvImportDialogOpen"
      initial-type="study_programs"
      @imported="handleCsvImported"
    />

    <v-snackbar v-model="snackbar" color="success" :timeout="3000">
      {{ snackbarText }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useCurriculumStore } from '@/stores/curriculum'
import CsvImportDialog from '@/components/CsvImportDialog.vue'
import type { ImportType } from '@/types/csvImport'

const store = useCurriculumStore()
const { curriculumVersions, studyPrograms } = storeToRefs(store)

const csvImportDialogOpen = ref(false)
const snackbar = ref(false)
const snackbarText = ref('')

function handleCsvImported(payload: { type: ImportType; count: number; items: any[] }) {
  store.fetchStudyPrograms()
  store.fetchCurriculumVersions()
  snackbarText.value = `${payload.count} study program${payload.count === 1 ? '' : 's'} imported successfully`
  snackbar.value = true
}

onMounted(() => {
  store.fetchCurriculumVersions()
  store.fetchStudyPrograms()
})
</script>