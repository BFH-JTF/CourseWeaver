<template>
  <v-container>
    <div class="d-flex align-center justify-space-between mb-1">
      <h1>Modules</h1>
      <div class="d-flex ga-2">
        <v-btn color="primary" prepend-icon="mdi-plus" @click="openNewModule">
          New Module
        </v-btn>
        <v-btn variant="outlined" prepend-icon="mdi-file-import" @click="csvImportDialogOpen = true">
          Import CSV
        </v-btn>
      </div>
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
          <th style="width:90px">Aktionen</th>
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
          <td>
            <v-btn size="x-small" icon="mdi-pencil" variant="text" @click="openEditModule(m)" />
            <v-btn size="x-small" icon="mdi-delete" variant="text" color="error" @click="deleteModule(m)" />
          </td>
        </tr>
        <tr v-if="modules.length === 0">
          <td colspan="6" class="text-center">No modules defined yet</td>
        </tr>
      </tbody>
    </v-table>

    <!-- Neues Modul anlegen -->
    <v-dialog v-model="moduleDialogOpen" max-width="620">
      <v-card>
        <v-card-title>{{ editing ? 'Edit Module' : 'New Module' }}</v-card-title>
        <v-card-text>
          <v-form ref="moduleFormRef" @submit.prevent="saveModule">
            <v-text-field v-model="moduleForm.code" label="Code" required variant="outlined" density="compact" />
            <v-text-field v-model="moduleForm.name" label="Name" required variant="outlined" density="compact" />
            <v-row dense>
              <v-col cols="6" md="3">
                <v-text-field v-model.number="moduleForm.creditPoints" label="ECTS" type="number" min="0" variant="outlined" density="compact" />
              </v-col>
              <v-col cols="6" md="3">
                <v-text-field v-model.number="moduleForm.contactHours" label="Contact hrs" type="number" min="0" variant="outlined" density="compact" />
              </v-col>
              <v-col cols="12" md="3">
                <v-text-field v-model.number="moduleForm.selfStudyHours" label="Self-study hrs" type="number" min="0" variant="outlined" density="compact" />
              </v-col>
              <v-col cols="12" md="3">
                <v-select
                  v-model="moduleForm.studyProgramIds"
                  :items="studyPrograms.map(p => ({ title: p.name ?? p._id, value: p._id ?? p.id }))"
                  label="Study program(s)" multiple chips variant="outlined" density="compact"
                />
              </v-col>
            </v-row>
            <v-textarea v-model="moduleForm.description" label="Description" rows="2" auto-grow variant="outlined" density="compact" />
          </v-form>
        </v-card-text>
        <v-divider />
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="moduleDialogOpen = false">Cancel</v-btn>
          <v-btn color="primary" variant="flat" prepend-icon="mdi-content-save" :loading="saving" @click="saveModule">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

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
import { usePostgres, EntityTables } from '@/composables/usePostgres'
import CsvImportDialog from '@/components/CsvImportDialog.vue'
import type { ImportType } from '@/types/csvImport'

const store = useCurriculumStore()
const { modules, studyPrograms } = storeToRefs(store)
void studyPrograms

const csvImportDialogOpen = ref(false)
const snackbar = ref(false)
const snackbarText = ref('')

function handleCsvImported(payload: { type: ImportType; count: number; items: any[] }) {
  store.fetchModules()
  snackbarText.value = `${payload.count} module${payload.count === 1 ? '' : 's'} imported successfully`
  snackbar.value = true
}

onMounted(() => {
  store.fetchCurriculumVersions()
  store.fetchStudyPrograms()
  store.fetchModules()
})

const { createEntity, updateEntity, removeEntity } = usePostgres()
const moduleDialogOpen = ref(false)
const editing = ref(false)
const saving = ref(false)
const moduleForm = ref<{
  id?: string
  _id?: string
  code: string
  name: string
  creditPoints?: number
  contactHours?: number
  selfStudyHours?: number
  studyProgramIds?: string[]
  description?: string
}>({ code: '', name: '' })

function openNewModule(): void {
  editing.value = false
  moduleForm.value = { code: '', name: '' }
  moduleDialogOpen.value = true
}

async function saveModule(): Promise<void> {
  saving.value = true
  try {
    const form = { ...moduleForm.value }
    // basic validation: code/name required
    if (!form.name) throw new Error('Name erforderlich')
    if (editing.value && (form.id || form._id)) {
      await updateEntity(EntityTables.MODULE, (form._id ?? form.id) as string, form)
    } else {
      const slug = form.code ? form.code.toLowerCase().replace(/[^a-z0-9]+/g, '-') : form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24)
      const payload = { ...form, id: `mod-${slug}` }
      await createEntity(EntityTables.MODULE, payload)
    }
    await store.fetchModules()
    moduleDialogOpen.value = false
    snackbarText.value = `${editing.value ? 'Module aktualisiert' : 'Modul angelegt'}: ${form.name}`
    snackbar.value = true
    editing.value = false
    moduleForm.value = { code: '', name: '' }
  } catch (e: any) {
    snackbarText.value = e.message || 'Fehler beim Speichern des Moduls'
    snackbar.value = true
  } finally {
    saving.value = false
  }
}

function openEditModule(m: any): void {
  editing.value = true
  moduleForm.value = {
    id: m.id ?? m._id,
    _id: m._id ?? m.id,
    code: m.code ?? '',
    name: m.name ?? '',
    creditPoints: m.creditPoints ?? undefined,
    contactHours: m.contactHours ?? undefined,
    selfStudyHours: m.selfStudyHours ?? undefined,
    studyProgramIds: m.studyProgramIds ?? [],
    description: m.description ?? '',
  }
  moduleDialogOpen.value = true
}

async function deleteModule(m: any): Promise<void> {
  if (!confirm(`Modul '${m.name ?? m._id}' wirklich löschen?`)) return
  try {
    await removeEntity(EntityTables.MODULE, m._id ?? m.id)
    await store.fetchModules()
    snackbarText.value = `Modul gelöscht: ${m.name ?? ''}`
    snackbar.value = true
  } catch (e: any) {
    snackbarText.value = e.message || 'Fehler beim Löschen des Moduls'
    snackbar.value = true
  }
}
</script>