<template>
  <v-container>
    <div class="d-flex align-center justify-space-between mb-1">
      <h1>Modules</h1>
      <v-btn
        variant="outlined"
        prepend-icon="mdi-file-import"
        @click="csvImportDialogOpen = true"
      >
        Import CSV
      </v-btn>
    </div>
    <p class="text-body-1 mt-2 mb-4">
      Manage modules, their details (credits, hours), and inter-module constraints (prerequisites, corequisites, exclusions).
    </p>
    <v-table>
      <thead>
        <tr>
          <th>Code</th>
          <th>Name</th>
          <th>Credits</th>
          <th>Contact hrs</th>
          <th>Self-study hrs</th>
          <th>Constraints</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="m in modules" :key="m._id">
          <td>{{ m.code }}</td>
          <td>{{ m.name }}</td>
          <td>{{ m.creditPoints }}</td>
          <td>{{ m.contactHours }}</td>
          <td>{{ m.selfStudyHours }}</td>
          <td>{{ m.constraints?.length ?? 0 }}</td>
        </tr>
        <tr v-if="modules.length === 0">
          <td colspan="6" class="text-center">No modules defined yet</td>
        </tr>
      </tbody>
    </v-table>

    <CsvImportDialog
      v-model="csvImportDialogOpen"
      initial-type="modules"
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
const { modules } = storeToRefs(store)

const csvImportDialogOpen = ref(false)
const snackbar = ref(false)
const snackbarText = ref('')

function handleCsvImported(payload: { type: ImportType; count: number; items: any[] }) {
  store.fetchModules()
  snackbarText.value = `${payload.count} module${payload.count === 1 ? '' : 's'} imported successfully`
  snackbar.value = true
}

onMounted(() => {
  store.fetchModules()
})
</script>