<template>
  <v-dialog :model-value="modelValue" max-width="1100" scrollable @update:model-value="emit('update:modelValue', $event)">
    <v-card>
      <v-card-item class="bg-primary text-white py-3">
        <v-card-title class="text-h6">Module-Concept-Import (mehrere Excel-Dateien)</v-card-title>
        <v-card-subtitle class="text-white text-opacity-80">
          Kap. 13: Programm wählen → mehrere Excel-Dateien (eine je Semester) → Vorschau gruppiert → alle speichern
        </v-card-subtitle>
      </v-card-item>

      <v-card-text>
        <!-- 1. Programm wählen (FK statt Freitext, Kap. 12.4) -->
        <v-select
          v-model="selectedProgramId"
          :items="programOptions"
          label="Masterprogramm (StudyProgram)"
          variant="outlined" density="compact" class="mb-3"
        />

        <!-- 2. Mehrere Dateien auswählen/droppen -->
        <div
          class="dropzone pa-4 mb-4 rounded-lg text-center"
          :class="{ 'bg-primary-lighten-5 border-primary': dragging }"
          @dragover.prevent="dragging = true"
          @dragleave.prevent="dragging = false"
          @drop.prevent="onFilesDrop"
          @click="fileInput?.click()"
        >
          <input ref="fileInput" type="file" class="d-none" multiple accept=".xlsx,.xls,.xlsm" @change="onFilesSelected" />
          <v-icon color="primary" class="mb-1">mdi-cloud-upload-outline</v-icon>
          <div class="text-body-2">Excel-Dateien hier ablegen oder anklicken — eine pro Semester, Mehrfachauswahl möglich</div>
          <div class="text-caption text-medium-emphasis mt-1">{{ parsedFiles.length }} Datei(en) geladen</div>
        </div>

        <v-alert v-for="f in parseErrors" :key="f.file" type="error" variant="tonal" density="compact" class="mb-2">
          {{ f.file }}: {{ f.message }}
        </v-alert>

        <!-- 3. Vorschau gruppiert nach Semester + Modul (nicht nach Datei) -->
        <div v-for="group in groupedPreview" :key="group.semester" class="mb-4">
          <div class="d-flex align-center mb-1">
            <span class="text-subtitle-2 font-weight-bold">Semester {{ group.semester }}</span>
            <v-spacer />
            <span class="text-caption text-medium-emphasis">{{ group.modules.length }} Module</span>
          </div>
          <v-table density="compact" class="border rounded">
            <thead><tr><th>Modul</th><th>ECTS</th><th class="text-center"># LCs</th></tr></thead>
            <tbody>
              <tr v-for="m in group.modules" :key="m.id">
                <td>{{ m.name }}</td>
                <td class="text-center">{{ m.ects ? m.ects + ' ECTS' : '? ECTS' }}</td>
                <td class="text-center">{{ m.learningCycles.length }}</td>
              </tr>
            </tbody>
          </v-table>
        </div>

        <!-- Semester je DATEI bestätigen/korrigieren (Kap. 13: Vorschlag aus Dateiname) -->
        <div v-if="parsedFiles.length" class="mb-3">
          <div class="text-subtitle-2 font-weight-medium mb-1">Semester-Zuordnung je Datei</div>
          <div v-for="f in parsedFiles" :key="f.file" class="d-flex align-center ga-2 mb-1">
            <span class="text-body-2 flex-grow-1 text-truncate">{{ f.file }}</span>
            <v-select
              v-model="f.semester"
              :items="[1, 2, 3, 4, 5, 6]"
              label="Semester" density="compact" variant="underlined" hide-details
              style="max-width: 110px"
            />
            <v-btn size="x-small" icon="mdi-close" variant="text" @click="removeFile(f.file)" />
          </div>
        </div>
      </v-card-text>

      <v-divider />
      <v-card-actions class="pa-4">
        <v-spacer />
        <v-btn variant="text" @click="emit('update:modelValue', false)">Abbrechen</v-btn>
        <v-btn
          color="primary" variant="flat" prepend-icon="mdi-content-save"
          :loading="saving" :disabled="allModules.length === 0 || !selectedProgramId" @click="saveAll"
        >
          Alle Module speichern ({{ allModules.length }})
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { parseModuleConceptWorkbook, inferSemesterFromFilename } from '@/utils/excelParser'
import type { CurriculumModule } from '@/types/curriculumMapping'
import { useCsvImport } from '@/composables/useCsvImport'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'imported': [payload: { count: number; modules: CurriculumModule[] }]
}>()

const { saveImportedData } = useCsvImport()

const selectedProgramId = ref<string>('')
const programOptions = ref<Array<{ value: string; title: string }>>([])

interface ParsedfileEntry {
  file: string
  semester: number
  modules: CurriculumModule[]
}

const parsedFiles = ref<ParsedfileEntry[]>([])
const parseErrors = ref<Array<{ file: string; message: string }>>([])
const dragging = ref(false)
const saving = ref(false)
const fileInput = ref<HTMLInputElement>()

/** Semester-Vorschlag aktualisieren, sobald neue Dateien geladen sind. */
watch(parsedFiles, (files) => {
  for (const f of files) {
    for (const m of f.modules) m.semester = f.semester
  }
}, { deep: true })

// Bei erneut geöffnetem Dialog auch Programmliste auffrischen (Programm-Wahl sei Schritt 1)
watch(() => props.modelValue, async (open) => {
  if (open) {
    try {
      const res = await fetch('/api/programs')
      if (res.ok) {
        const list = (await res.json()) as any[]
        programOptions.value = list.map(p => ({ value: p._id ?? p.id, title: p.title ?? p.name ?? p._id }))
        if (programOptions.value.length && !selectedProgramId.value) selectedProgramId.value = programOptions.value[0]!.value
      }
    } catch { /* Dropdown bleibt leer */ }
  }
})

function onFilesSelected(event: Event): void {
  // Mehrfachauswahl — alle Dateien werden verarbeitet (Kap. 12.1)
  const input = event.target as HTMLInputElement
  Array.from(input.files ?? []).forEach(readUploadedFile)
  input.value = ''
}

function onFilesDrop(evt: DragEvent): void {
  dragging.value = false
  Array.from(evt.dataTransfer?.files ?? []).forEach(readUploadedFile)
}

/** Kap. 13 (2): parse je Datei, Semester aus dem Dateinamen vorgeschlagen. */
function readUploadedFile(file: File): void {
  const suggestedSemester = inferSemesterFromFilename(file.name) ?? parsedFiles.value.length + 1
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const parsed = parseModuleConceptWorkbook(e.target?.result as ArrayBuffer, {
        studyProgramId: selectedProgramId.value,
        semester: suggestedSemester,
        sourceFile: file.name,
      })
      parsedFiles.value = [...parsedFiles.value.filter(f => f.file !== file.name), { file: file.name, semester: suggestedSemester, modules: parsed.modules }]
    } catch (err: any) {
      parseErrors.value = [
        ...parseErrors.value.filter(x => x.file !== file.name),
        { file: file.name, message: err.message ?? 'Parse-Fehler' },
      ]
    }
  }
  reader.readAsArrayBuffer(file)
}

function removeFile(fileName: string): void {
  parsedFiles.value = parsedFiles.value.filter(f => f.file !== fileName)
}

/** Kap. 13 (3): Vorschau gruppiert nach Semester + Modul. */
const groupedPreview = computed<Array<{ semester: number; modules: CurriculumModule[] }>>(() => {
  const groups = new Map<number, CurriculumModule[]>()
  for (const f of parsedFiles.value) {
    for (const m of f.modules) {
      m.semester = f.semester
      const list = groups.get(f.semester) ?? []
      list.push(m)
      groups.set(f.semester, list)
    }
  }
  return [...groups.entries()]
    .map(([semester, modules]) => ({ semester, modules: [...modules].sort((a, b) => a.name.localeCompare(b.name)) }))
    .sort((a, b) => a.semester - b.semester)
})

const allModules = computed<CurriculumModule[]>(() => groupedPreview.value.flatMap(g => g.modules))

/** Kap. 13 (3): alle Dateien in einem Schritt speichern — via zentralen useCsvImport (Tabelle curriculum_modules). */
async function saveAll(): Promise<void> {
  saving.value = true
  try {
    const withProgram = allModules.value.map(m => ({ ...m, studyProgramId: selectedProgramId.value }))
    const count = await saveImportedData('learning_cycles', withProgram as unknown as Record<string, unknown>[])
    emit('imported', { count, modules: withProgram })
    emit('update:modelValue', false)
    parsedFiles.value = []
  } finally {
    saving.value = false
  }
}
</script>
