<template>
  <v-container>
    <div class="view-hero">
      <h1 class="text-h4 font-weight-bold">Modules</h1>
      <div class="text-body-2 opacity-90">
        Modulprofile je Dozierender: Name, ECTS, Kontaktstunden, Co-Teaching, Lernziele und Inhalte für LC1–LC6 (mit Dropdowns für wiederkehrende Elemente).
      </div>
    </div>

    <!-- Dozierenden-Filter -->
    <v-row dense class="mb-2">
      <v-col cols="12" md="4">
        <v-select
          v-model="selectedLecturerId"
          :items="lecturerOptions"
          label="Dozierende*r"
          variant="outlined"
          density="compact"
          clearable
        />
      </v-col>
      <v-col cols="12" md="4">
        <v-select
          v-model="selectedClassId"
          :items="classOptions"
          label="Kohorte (Class)"
          variant="outlined"
          density="compact"
          clearable
        />
      </v-col>
      <v-col cols="12" md="4">
        <div class="text-caption text-medium-emphasis d-flex align-center ga-2 h-100">
          <v-icon size="18" icon="mdi-lightbulb-on-outline" />
          Klick auf ein Modul öffnet die LC-Tabelle (unten).
        </div>
      </v-col>
    </v-row>

    <!-- Module des ausgewählten Dozierenden -->
    <v-row dense>
      <v-col cols="12" md="4">
        <v-card
          v-for="m in filteredModuleProfiles"
          :key="m.id"
          variant="flat"
          class="pa-3 mb-2 card-lift"
          :class="{ 'border-primary': selectedModuleId === m.id }"
          :style="selectedModuleId === m.id ? 'outline: 2px solid var(--v-theme-primary)' : ''"
          @click="selectModule(m.id)"
        >
          <div class="d-flex align-center justify-space-between ga-2">
            <div>
              <div class="text-subtitle-1 font-weight-bold">{{ m.name }}</div>
              <div class="text-caption text-medium-emphasis">{{ m.code }}</div>
            </div>
            <div class="d-flex flex-column align-end">
              <v-chip size="x-small" variant="tonal" color="primary">{{ m.creditPoints }} ECTS</v-chip>
              <v-chip size="x-small" variant="tonal" class="mt-1" color="info">{{ m.contactHours }} h Kontakt</v-chip>
            </div>
          </div>
          <div class="mt-2 d-flex ga-1 flex-wrap">
            <v-chip v-for="instr in m.instructor_ids" :key="instr" size="x-small" variant="outlined">{{ lecturerName(instr) }}</v-chip>
            <v-chip v-if="(m.instructor_ids ?? []).length >= 2" size="x-small" color="success" variant="tonal">Co-Teaching</v-chip>
            <v-chip v-if="(m.classIds ?? []).length" size="x-small" variant="tonal" color="warning">{{ classLabel(m.classIds?.[0]) }}</v-chip>
          </div>
        </v-card>
        <div v-if="filteredModuleProfiles.length === 0" class="text-caption text-medium-emphasis">
          Keine Module für die Auswahl.
        </div>
      </v-col>

      <!-- LC-Tabelle des gewählten Moduls -->
      <v-col cols="12" md="8">
        <v-card variant="flat" class="pa-4 card-lift" v-if="selectedModuleId">
          <div class="d-flex align-center justify-space-between mb-2">
            <h2 class="text-h6">Learning Cycles — {{ selectedModule?.name }}</h2>
            <v-btn color="primary" size="small" prepend-icon="mdi-content-save" :loading="savingContent" @click="saveLcContents">
              Alle LCs speichern
            </v-btn>
          </div>
          <v-alert v-if="!curriculumModules.find(cm => cm.id === selectedModuleId)" type="info" variant="tonal" density="compact" class="mb-2">
            Für dieses Modul sind keine Excel-Lernzyklen vorhanden — LC-Zeilen werden neu angelegt, wenn gespeichert wird.
          </v-alert>
          <v-table class="lc-table">
            <thead>
              <tr>
                <th style="width:64px">LC</th>
                <th style="width:47%">Lernziele (Learning Goals) · Kompetenzen</th>
                <th>Inhalte · Methoden</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in lcRows" :key="row.id">
                <td>
                  <v-chip size="small" variant="tonal" color="primary">LC{{ row.lcNumber }}</v-chip>
                </td>
                <td>
                  <v-textarea
                    v-model="row.learningGoals"
                    variant="outlined" density="compact" rows="3" auto-grow hide-details
                  />
                </td>
                <td>
                  <v-select
                    v-model="row.competencies"
                    :items="competencyOptions"
                    multiple chips closable-chips
                    variant="outlined" density="compact" hide-details
                    placeholder="Kompetenzen wählen"
                  />
                </td>
                <td>
                  <v-textarea
                    v-model="row.content"
                    variant="outlined" density="compact" rows="3" auto-grow hide-details
                  />
                </td>
                <td>
                  <v-select
                    v-model="row.methods"
                    :items="METHODS_TOOLKIT"
                    multiple chips closable-chips
                    variant="outlined" density="compact" hide-details
                  />
                </td>
              </tr>
              <tr v-if="lcRows.length === 0">
                <td colspan="3" class="text-center text-caption">Keine Lernzyklen für dieses Modul.</td>
              </tr>
            </tbody>
          </v-table>
        </v-card>
        <v-card v-else variant="flat" class="pa-6 text-center card-lift">
          <v-icon size="42" color="primary" icon="mdi-cursor-default-click-outline" />
          <div class="text-body-1 mt-2">Wähle links ein Modul, um LC1–LC6 zu bearbeiten.</div>
        </v-card>
      </v-col>
    </v-row>

    <v-snackbar v-model="snackbar" color="success" :timeout="3000">{{ snackbarText }}</v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
// Neu: Modulansicht "Modules" (data-model-comparison + Anfrage vom 29.09.2026):
// Einzeldarstellung der Module je Dozierender inkl. LC1–LC6 mit Dropdowns für
// wiederkehrende Elemente (Kompetenz-Katalog & Methoden-Toolkit).
import { ref, computed, onMounted } from 'vue'
import { usePostgres, EntityTables } from '@/composables/usePostgres'
import { useCurriculumStore } from '@/stores/curriculum'
import { useCompetencies } from '@/composables/useCompetencies'
import type { Module } from '@/types/curriculum'
import type { ClassEntity } from '@/types/curriculumClass'

const METHODS_TOOLKIT = [
  'Lecture (Input)', 'Case Study', 'Gruppenarbeit', 'Flip Teaching',
  'Diskussion / Debrief', 'Workshop', 'Selbststudium (Podcast/Lesetext)',
  'Selbsttest & Feedback', 'Peer Review', 'Online-Übung / Simulation',
  'Exkursion', 'Präsentation',
]

interface LcContentRow {
  id?: string
  _id?: string
  moduleId: string
  lcNumber: number
  lcTitle?: string
  learningGoals: string
  content: string
  assignment?: string
  competencies: string[]
  methods: string[]
}

const store = useCurriculumStore()
void store

const { fetchEntities, updateEntity } = usePostgres()
const { competencies, fetchCompetencies } = useCompetencies()

const modules = ref<any[]>([])
const lecturers = ref<any[]>([])
const classRows = ref<ClassEntity[]>([])
const curriculumModules = ref<any[]>([])
const lcContents = ref<LcContentRow[]>([])

const selectedLecturerId = ref<string | null>(null)
const selectedClassId = ref<string | null>(null)
const selectedModuleId = ref<string | null>(null)

const savingContent = ref(false)
const snackbar = ref(false)
const snackbarText = ref('')

const lecturerOptions = computed(() => lecturers.value.map(l => ({
  title: l.name ?? l.display_name ?? l.id,
  value: l.id ?? l._id,
})))

const competencyOptions = computed(() => competencies.value.map(c => ({
  title: c.name ?? (c as any).title,
  value: c.id ?? c._id,
})))

const classOptions = computed(() => classRows.value.map(c => ({
  title: c.name ?? c.code ?? c._id,
  value: c.id ?? c._id,
})))

function selectModule(id: string) {
  selectedModuleId.value = id
  ensureLcRowsForModule()
}

const selectedModule = computed(() => modules.value.find(m => (m.id ?? m._id) === selectedModuleId.value))

const filteredModuleProfiles = computed(() =>
  modules.value.filter(m => {
    const matchesLecturer = !selectedLecturerId.value || (m.instructor_ids ?? []).includes(selectedLecturerId.value)
    const matchesClass = !selectedClassId.value || (m.classIds ?? []).includes(selectedClassId.value)
    return matchesLecturer && matchesClass
  }),
)


const lcRows = computed(() =>
  lcContents.value.filter(r => r.moduleId === selectedModuleId.value).sort((a, b) => a.lcNumber - b.lcNumber),
)

function lecturerName(id: string): string {
  const l = lecturers.value.find(x => (x.id ?? x._id) === id)
  return l?.name ?? id
}

function classLabel(id: string): string {
  const c = classRows.value.find(x => (x.id ?? x._id) === id)
  return c?.name ?? id
}

function ensureLcRowsForModule() {
  if (!selectedModuleId.value) return
  if (lcRows.value.length > 0) return
  const cur = (curriculumModules.value ?? []).find(cm => cm.id === selectedModuleId.value)
  const cycles = (cur?.learningCycles ?? [])
  const competencyIds = competencies.value.map(c => String(c.id ?? c._id))
  for (let n = 1; n <= 6; n++) {
    const lc: any = cycles[n - 1]
    lcContents.value.push({
      id: `content-${selectedModuleId.value}-lc${n}`,
      moduleId: selectedModuleId.value,
      lcNumber: n,
      lcTitle: lc?.structuralElement ?? `Learning Cycle ${n}`,
      learningGoals: String(lc?.learningGoals ?? ''),
      content: String(lc?.mainContent ?? ''),
      assignment: String(lc?.assignmentDescription ?? ''),
      competencies: competencyIds.slice(0, 2),
      methods: METHODS_TOOLKIT.slice(0, 2),
    })
  }
}

async function saveLcContents() {
  if (!selectedModuleId.value) return
  savingContent.value = true
  try {
    for (const row of lcRows.value) {
      const { _id, ...rest } = row as any
      await updateEntity(EntityTables.LC_CONTENT, String(_id ?? row.id), rest)
    }
    snackbarText.value = 'Learning Cycles gespeichert'
    snackbar.value = true
  } catch (e: any) {
    snackbarText.value = e.message || 'Fehler beim Speichern'
    snackbar.value = true
  } finally {
    savingContent.value = false
  }
}


onMounted(async () => {
  await Promise.all([
    store.fetchModules?.() ?? Promise.resolve(),
    fetchEntities<Module>(EntityTables.MODULE).then(j => (modules.value = j)),
    fetchEntities<any>(EntityTables.LECTURER).then(j => (lecturers.value = j)),
    fetchEntities<ClassEntity>(EntityTables.CLASS).then(j => (classRows.value = j)),
    fetchEntities<any>(EntityTables.CURRICULUM_MODULE).then(j => (curriculumModules.value = j)),
    fetchEntities<LcContentRow>(EntityTables.LC_CONTENT).then(j => (lcContents.value = j)),
    fetchCompetencies(),
  ])
})
</script>

<style scoped>
.lc-table td { vertical-align: top; }
.lc-table { table-layout: fixed; width: 100%; }
.lc-row td { vertical-align: top !important; }
.lc-cell-wide { width: 47%; }
.lc-cell-lc { width: 64px; text-align: center; }
.lc-stack { display: flex; flex-direction: column; align-items: stretch; gap: 2px; }
.lc-cap { margin-bottom: 2px; }
</style>
