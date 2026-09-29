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
                  :items="studyPrograms.map((p: StudyProgram) => ({ title: p.name ?? p._id, value: p._id ?? p.id}))"
                  label="Study program(s)" multiple chips variant="outlined" density="compact"
                />
              </v-col>
              <v-col cols="12">
                <!-- data-model-comparison.md §3.1 — Kohorte (Class) ans Modul hängen -->
                <v-select
                  v-model="moduleForm.classIds"
                  :items="classes.map(c => ({ title: c.name ?? c._id, value: c._id ?? c.id }))"
                  label="Kohorte (Class)" multiple chips variant="outlined" density="compact" clearable
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

    <!-- data-model-comparison.md §3.1/§3.5 — Kohorten (Class) verwalten -->
    <v-card variant="tonal" class="mt-6 pa-3">
      <div class="d-flex align-center justify-space-between mb-1">
        <h2 class="text-h6">Kohorten (Classes)</h2>
        <div class="d-flex ga-2">
          <v-btn size="small" color="primary" prepend-icon="mdi-plus" @click="openNewClass">Neue Kohorte</v-btn>
          <v-btn size="small" variant="outlined" prepend-icon="mdi-migration" :loading="migrating" @click="runMigration">
            (program, semester) → Class
          </v-btn>
        </div>
      </div>
      <p class="text-body-2 mb-2">
        Kohorten gruppieren Module eines Programms in einem Semester — die Solver-Kohorten-Verbindlichkeit hängt an der Class (data-model-comparison.md §3.1).‫
      </p>
      <v-table density="compact">
        <thead>
          <tr>
            <th>Name</th><th>Programm</th><th>Semester</th><th>Curriculum-Version</th><th>Module</th><th style="width:90px">Aktionen</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in classRows" :key="c._id">
            <td>{{ c.name }}</td>
            <td>{{ c.programId || programLabel(c.programIds?.[0]) }}</td>
            <td>{{ c.semesterId || " — " }}</td>
            <td>{{ versionNumber(c.curriculumVersionId) || '—' }}</td>
            <td>{{ (c.moduleIds ?? []).length }}</td>
            <td>
              <v-btn size="x-small" icon="mdi-pencil" variant="text" @click="openEditClass(c)" />
              <v-btn size="x-small" icon="mdi-delete" variant="text" color="error" @click="deleteClass(c)" />
            </td>
          </tr>
          <tr v-if="classRows.length === 0"><td colspan="6" class="text-center">No cohorts yet</td></tr>
        </tbody>
      </v-table>
    </v-card>

    <!-- Neue Kohorte anlegen/bearbeiten -->
    <v-dialog v-model="classDialogOpen" max-width="620">
      <v-card>
        <v-card-title>{{ classEditing ? 'Edit Cohort (Class)' : 'New Cohort (Class)' }}</v-card-title>
        <v-card-text>
          <v-form @submit.prevent="saveClass">
            <v-text-field v-model="classForm.name" label="Name" required variant="outlined" density="compact" />
            <v-row dense>
              <v-col cols="12" md="4">
                <v-text-field v-model="classForm.programId" label="Programm-ID" variant="outlined" density="compact" />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field v-model="classForm.semesterId" label="Semester-ID" variant="outlined" density="compact" />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field v-model.number="classForm.size" label="Grösse" type="number" min="0" variant="outlined" density="compact" />
              </v-col>
              <!-- data-model-comparison.md §3.5 — Kohorten erhalten aktive Curriculum-Version -->
              <v-col cols="12">
                <v-select
                  v-model="classForm.curriculumVersionId"
                  :items="curriculumVersions.map((v: CurriculumVersion) => ({ title: versionNumber(v._id ?? v.id) ?? v.name, value: v._id ?? v.id }))"
                  label="Curriculum-Version (aktiv für diese Kohorte)" variant="outlined" density="compact" clearable
                />
              </v-col>
              <v-col cols="12">
                <v-select
                  v-model="classForm.moduleIds"
                  :items="modules.map(m => ({ title: m.code ? `${m.code} – ${m.name}` : m.name, value: m._id ?? m.id }))"
                  label="Module dieser Kohorte" multiple chips variant="outlined" density="compact"
                />
              </v-col>
            </v-row>
            <v-textarea v-model="classForm.description" label="Description" rows="1" auto-grow variant="outlined" density="compact" />
          </v-form>
        </v-card-text>
        <v-divider />
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="classDialogOpen = false">Cancel</v-btn>
          <v-btn color="primary" variant="flat" prepend-icon="mdi-content-save" :loading="classSaving" @click="saveClass">Save</v-btn>
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
import { ref, computed, onMounted } from 'vue'
// data-model-comparison.md §3.1/§3.5 — Class (Kohorte) Verwaltung in CourseWeaver
import { useClasses, emptyClass } from '@/composables/useClasses'
import { useCurriculumVersions } from '@/composables/useCurriculumVersions'
import type { ClassEntity } from '@/types/curriculumClass'
import type { CurriculumVersion } from '@/stores/curriculum'
import { storeToRefs } from 'pinia'
import { useCurriculumStore } from '@/stores/curriculum'
import { usePostgres, EntityTables } from '@/composables/usePostgres'
import CsvImportDialog from '@/components/CsvImportDialog.vue'
import type { ImportType } from '@/types/csvImport'
import type { StudyProgram } from '@/types/curriculum'

const store = useCurriculumStore()
const { modules } = storeToRefs(store)
const studyPrograms = computed(() => (store.programs ?? []) as unknown as StudyProgram[])

const csvImportDialogOpen = ref(false)

// ─── data-model-comparison.md §3.1/§3.5 — Class (Kohorte) Verwaltung ───
const { classes, fetchClasses, addClass, updateClass, removeClass } = useClasses()
const { curriculumVersions, fetchCurriculumVersions: fetchVersions } = useCurriculumVersions()

const classRows = computed(() => classes.value.map(c => ({ ...c, _id: c._id ?? c.id ?? '' })))

const classDialogOpen = ref(false)
const classEditing = ref(false)
const classSaving = ref(false)
const migrating = ref(false)
const classForm = ref<ClassEntity>(emptyClass())

onMounted(() => {
  void fetchClasses()
  void fetchVersions()
})

function openNewClass() {
  classEditing.value = false
  classForm.value = emptyClass()
  classDialogOpen.value = true
}

function openEditClass(c: ClassEntity) {
  classEditing.value = true
  classForm.value = {
    ...(c.id ? { id: c.id, _id: c._id } : {}),
    name: c.name ?? '',
    programId: c.programId ?? c.programIds?.[0] ?? '',
    semesterId: c.semesterId ?? '',
    curriculumVersionId: c.curriculumVersionId,
    size: c.size ?? 0,
    moduleIds: [...(c.moduleIds ?? [])],
    description: c.description ?? '',
    code: c.code,
  }
  classDialogOpen.value = true
}

async function saveClass() {
  classSaving.value = true
  try {
    const row: ClassEntity = {
      ...(classForm.value.id ? { id: classForm.value.id, _id: classForm.value._id } : {}),
      name: classForm.value.name,
      programId: classForm.value.programId,
      programIds: classForm.value.programId ? [classForm.value.programId] : [],
      semesterId: classForm.value.semesterId,
      curriculumVersionId: classForm.value.curriculumVersionId,
      size: classForm.value.size,
      moduleIds: [...(classForm.value.moduleIds ?? [])],
      description: classForm.value.description,
      code: classForm.value.code,
    }
    if (classEditing.value && row.id) await updateClass(row)
    else await addClass(row)
    snackbarText.value = classEditing.value ? 'Kohorte aktualisiert' : 'Kohorte angelegt'
    snackbar.value = true
    classDialogOpen.value = false
  } finally {
    classSaving.value = false
  }
}

async function deleteClass(c: ClassEntity) {
  const id = c.id ?? c._id
  if (!id) return
  if (!confirm(`Kohorte "${c.name}" löschen?`)) return
  await removeClass(id)
  snackbarText.value = 'Kohorte gelöscht'
  snackbar.value = true
}

function programLabel(id?: string): string {
  return id ?? '—'
}

function versionNumber(id?: string): string | undefined {
  const v = curriculumVersions.value.find(x => (x._id ?? x.id) === id)
  return v ? `v${v.versionNumber}` : undefined
}

async function runMigration() {
  migrating.value = true
  try {
    // Die eigentliche Migration läuft serverseitig (server/migrate-classes.ts),
    // hier laden wir die aktuellen Kohorten neu.
    await fetchClasses()
    snackbarText.value = classes.value.length + ' Kohorten geladen (Server-Skript server/migrate-classes.ts)'
    snackbar.value = true
  } finally {
    migrating.value = false
  }
}

const snackbar = ref(false)
const snackbarText = ref('')

function handleCsvImported(payload: { type: ImportType; count: number; items: any[] }) {
  store.fetchModules()
  snackbarText.value = `${payload.count} module${payload.count === 1 ? '' : 's'} imported successfully`
  snackbar.value = true
}

onMounted(() => {
  store.fetchCurriculumVersions()
  store.fetchPrograms()
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
  classIds?: string[]
  description?: string
}>({ code: '', name: '', classIds: [] })

function openNewModule(): void {
  editing.value = false
  moduleForm.value = { code: '', name: '', classIds: [] }
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
    moduleForm.value = { code: '', name: '', classIds: [] }
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
    classIds: m.classIds ?? [],
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