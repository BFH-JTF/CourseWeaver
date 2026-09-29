<template>
  <div class="curriculum-page">
  <v-container fluid>
    <!-- Einheitlicher Kopf + Pipeline-Leiste (identisch zur Curriculum-Import-Ansicht) -->
    <div class="view-hero">
      <div class="d-flex align-center justify-space-between flex-wrap ga-3">
        <div>
          <h1 class="text-h4 font-weight-bold">Curriculum Mapping</h1>
          <div class="text-body-2 opacity-90">
            Review — Constructive Alignment über alle Master-Module: Von den strategischen Themenfeldern
            über Lernziele (I–R–M-Logik) zu Lernaktivitäten und Leistungsnachweisen.
          </div>
        </div>
      <v-btn
        size="small"
        variant="outlined"
        color="accent"
        prepend-icon="mdi-refresh"
        :loading="loading"
        @click="load"
      >
        Neu laden
      </v-btn>
      </div>
    </div>

    <!-- Pipeline-Navigation: identisch zu CurriculumMappingPage; Schritte 1-4 navigieren dorthin -->
    <PipelineStepper
      :states="stepperStates"
      :clickable-steps="STEP_KEYS"
      class="my-4"
      @step-click="onStepClick"
    />

    <v-alert v-if="error" type="error" variant="tonal" closable class="mb-4" @click:close="error = null">
      {{ error }}
    </v-alert>
    <v-alert
      v-if="!loading && !error && themesInProgram.length === 0"
      type="info"
      variant="tonal"
      class="mb-4"
    >
      Keine Strategischen Themenfelder bzw. Modul-Zuordnungen im Datenbestand. Importiere Module mit
      <code>strategic_theme_ids</code> bzw. <code>terms</code>-Einträgen (category
      <code>strategic_theme</code>), oder verknüpfe das Programm korrekt.
    </v-alert>

    <v-card variant="flat" class="mb-6 pa-4" max-width="480">
      <v-select
        v-model="selectedProgramId"
        :items="programs.map(p => ({ title: programName(p), value: p._id ?? p.id }))"
        label="Masterprogramm"
        variant="outlined"
        density="compact"
        hide-details
      >
        <template #prepend-inner>
          <v-icon icon="mdi-school-outline" size="small" class="me-1 text-medium-emphasis" />
        </template>
      </v-select>
    </v-card>

    <!-- Ansichten (Kap. 8): Themes | Overlap-Matrix | Progression & Alignment -->
    <v-btn-toggle v-model="sectionTab" mandatory color="primary" variant="outlined" class="mb-4" density="comfortable">
      <v-btn value="themes" prepend-icon="mdi-bullseye-arrow">Themenfelder</v-btn>
      <v-btn value="overlap" prepend-icon="mdi-table-heart">Content-Overlap</v-btn>
      <v-btn value="alignment" prepend-icon="mdi-stairs-up">Progression &amp; Alignment</v-btn>
      <v-btn value="reports" prepend-icon="mdi-file-chart">Berichte</v-btn>
    </v-btn-toggle>

    <template v-if="sectionTab === 'themes'">

    <!-- 1. Strategische Themenfelder -->
    <h2 class="text-h6 mb-2">
      <v-icon start icon="mdi-bullseye-arrow" color="primary" />
      Strategische Themenfelder
    </h2>
    <p class="text-body-2 text-medium-emphasis mb-3">
      Startpunkt des Mapping: Abdeckung der Themenfelder durch Module des Programms.
    </p>
    <!-- Unmapped modules: drag me onto a theme card to assign -->
    <v-card variant="outlined" class="pa-3 mb-4" v-if="unassignedModules.length > 0">
      <div class="d-flex align-center mb-2">
        <span class="text-subtitle-1 font-weight-bold">{{ unassignedModules.length }} Module ohne Themenfeld</span>
        <span class="text-caption text-medium-emphasis ms-2">per Drag &amp; Drop einem Themenfeld zuordnen</span>
      </div>
      <div class="d-flex flex-wrap">
        <v-card
          v-for="m in unassignedModules" :key="m._id"
          variant="outlined" class="pa-2 ma-1 pool-card"
          style="min-width: 220px"
          draggable="true"
          @dragstart="onAssignDragStartModule(m, $event)"
        >
          <div class="text-body-2 font-weight-medium">{{ moduleName(m) }}</div>
          <div class="text-caption text-medium-emphasis">
            {{ m.credits ?? '?' }} ECTS
          </div>
        </v-card>
      </div>
    </v-card>

    <v-row dense class="mb-8">
      <v-col v-for="theme in themesInProgram" :key="theme._id" cols="12" md="6" lg="4">
        <v-card
          variant="tonal" color="primary" class="h-100 theme-card"
          :class="{ 'drop-over': assignedDragOver === theme._id }"
          @dragover.prevent
          @dragenter.prevent="assignedDragOver = theme._id"
          @dragleave="assignedDragOver === theme._id && (assignedDragOver = null)"
          @drop.prevent="assignDrop(theme, $event)"
        >
          <v-card-item>
            <v-card-title class="text-subtitle-1">{{ theme.title }}</v-card-title>
            <v-card-subtitle>
              {{ modulesByTheme.get(theme._id)?.length ?? 0 }} Module
            </v-card-subtitle>
          </v-card-item>
          <v-card-text class="pt-0">
            <div class="d-flex flex-wrap">
              <v-card
                v-for="m in modulesByTheme.get(theme._id)" :key="m._id"
                variant="outlined"
                class="pa-1 ma-1 pool-card theme-tile-assigned"
                style="min-width: 120px"
                draggable="true"
                @dragstart="onChipDragStart(m, theme._id, $event)"
              >
                <div class="d-flex align-center justify-space-between ga-1">
                  <div class="text-body-2" style="max-width:150px">{{ moduleName(m) }}</div>
                  <v-btn
                    icon="mdi-close"
                    size="x-small" variant="text"
                    @click.stop="unassignFromTheme(m._id, theme._id)"
                  />
                </div>
                <div class="text-caption text-medium-emphasis">
                  {{ m.credits ?? '?' }} ECTS
                </div>
              </v-card>
            </div>
            <span v-if="assignedDragOver === theme._id" class="text-caption">Drop hier…</span>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
    </template>

    <!-- Progression & Alignment-Ansicht: IRM-Matrix, Coverage, Assurance-Elemente -->
        <template v-if="sectionTab === 'alignment'">
    <div class="d-flex align-center ga-3 mb-3">
      <span class="text-subtitle-1 font-weight-bold">Progression &amp; Alignment</span>
      <v-btn-toggle v-model="alignmentSubtab" mandatory density="compact" variant="outlined" color="primary">
        <v-btn value="matrix">Kompetenz-Matrix</v-btn>
        <v-btn value="rubrics">Rubriken</v-btn>
        <v-btn value="aol">AoL-Messpunkte</v-btn>
        <v-btn value="loop">Closing the loop</v-btn>
      </v-btn-toggle>
    </div>
    <AssurancePanels :initial-tab="alignmentSubtab" />
    </template>

    <!-- Content-Overlap-Ansicht: Modulmatrix + Drill-down + offene Prüfpunkte -->
    <template v-if="sectionTab === 'overlap'">
      <v-alert type="info" variant="tonal" class="mb-4">
        Vier Fragen des Curriculum Mappings: (1) Wo werden Inhalte mehrfach behandelt? (2) Redundanz oder
        gerichtete Progression (I–R-M)? (3) Was fehlt gegenüber den strategischen Themenfeldern?
        (4) Passt Lernziel ↔ Lehrmethode ↔ Assessment je Learning Cycle? — Berechnung läuft serverseitig
        (heuristisch bzw. mit konfigurierter Ollama-Anbindung, Kap. 3/7).
      </v-alert>

      <div class="d-flex ga-2 mb-4">
        <v-btn variant="tonal" color="primary" prepend-icon="mdi-play" :loading="mappingLoading" @click="runMapping">
          Analyse ausführen
        </v-btn>
        <span class="text-caption align-center text-medium-emphasis">
          Modus: {{ mappingMode === 'ollama' ? 'LLM (Ollama lokal)' : 'Heuristik (lexical)' }}
        </span>
      </div>

      <v-alert
        v-if="mappingCycles.length === 0"
        type="info"
        variant="tonal"
        class="mb-4"
      >
        Keine persistierten Learning Cycles. Importiere die Modul-Excels über den CSV/Excel-Import
        (Typ „Module (Learning Cycles)“) oder lade <code>learning_cycles</code>-Records.
      </v-alert>

      <template v-else>
        <h2 class="text-h6 mb-2"><v-icon start icon="mdi-table-heart" color="primary" /> Modul-zu-Modul-Matrix</h2>
        <v-chip-group class="mb-4">
          <v-chip
            v-for="pair in matrixRows"
            :key="pair.moduleAId + '||' + pair.moduleBId"
            :color="colorOf(pair.topRelationship)"
            variant="tonal"
            size="small"
            class="ma-1 cursor-pointer"
            @click="drill(pair)"
          >
            {{ pair.moduleAId }} × {{ pair.moduleBId }} — {{ pair.topRelationship }}
            (sim {{ pair.maxSimilarity.toFixed(2) }})
          </v-chip>
        </v-chip-group>

        <h2 class="text-h6 mt-6 mb-2"><v-icon start icon="mdi-flag" color="warning" /> Offene Prüfpunkte — Content-Overlap</h2>
        <v-list lines="two" class="border rounded mb-6">
          <v-list-item v-for="e in openOverlaps" :key="e.id" style="cursor: pointer" @click="drillEntryRaw(e)">
            <template #prepend>
              <v-chip :color="colorOf(e.assessment.relationship)" size="small" label>{{ e.reviewPriority }}</v-chip>
            </template>
            <v-list-item-title>
              cycles {{ e.cycleAId }} × {{ e.cycleBId }} — {{ descriptionOf(e.assessment.relationship) }}
            </v-list-item-title>
            <v-list-item-subtitle>
              {{ e.assessment.rationale }} (Konfidenz {{ e.assessment.confidence.toFixed(2) }}, Sim {{ e.embeddingSimilarity.toFixed(2) }})
            </v-list-item-subtitle>
          </v-list-item>
          <v-list-item v-if="openOverlaps.length === 0">
            <template #prepend><v-icon color="success">mdi-check-circle</v-icon></template>
            <v-list-item-title>Keine offenen Overlap-Prüfpunkte.</v-list-item-title>
          </v-list-item>
        </v-list>
      </template>

      <!-- Drill-down Detailansicht eines Paars (Kap. 8.2): Originaltexte nebeneinander -->
      <v-dialog v-model="drillOpen" max-width="1100" scrollable>
        <v-card>
          <v-card-item>
            <v-card-title>Drill-down: {{ drillPairReadable }}</v-card-title>
            <v-card-subtitle>{{ drillDesc }}</v-card-subtitle>
          </v-card-item>
          <v-card-text>
            <v-row v-if="drillEntry">
              <v-col cols="12" md="6" v-for="side in drillSides" :key="side.cycleId">
                <v-card variant="outlined" class="pa-3">
                  <div class="text-subtitle-2">{{ side.moduleId }} · {{ side.structuralElement }} · Niveau {{ side.level ?? '–' }} · {{ side.assignmentType ?? 'kein Assignment' }}</div>
                  <div class="text-caption mt-2 font-weight-bold">Lernziele</div>
                  <div class="text-body-2" style="white-space: pre-line">{{ side.learningGoals }}</div>
                  <div class="text-caption mt-2 font-weight-bold">Inhalte</div>
                  <div class="text-body-2" style="white-space: pre-line">{{ side.mainContent }}</div>
                  <div class="text-caption mt-2 font-weight-bold">Didaktik</div>
                  <div class="text-body-2" style="white-space: pre-line">{{ side.didactics }}</div>
                  <div v-if="side.assignmentDescription" class="text-caption mt-2 font-weight-bold">Assessment</div>
                  <div v-if="side.assignmentDescription" class="text-body-2" style="white-space: pre-line">{{ side.assignmentDescription }}</div>
                </v-card>
              </v-col>
            </v-row>
            <div v-if="drillEntry" class="mt-4">
              <div class="text-body-2">
                <b>Bewertung:</b> {{ drillEntry.assessment.relationship }} — {{ drillDesc }}
                (gerichtet: A {{ drillEntry.assessment.overlapA }}, B {{ drillEntry.assessment.overlapB }} ·
                Embedding {{ drillEntry.embeddingSimilarity.toFixed(2) }}<template v-if="drillEntry.lexicalSimilarity != null">, lexical {{ drillEntry.lexicalSimilarity.toFixed(2) }}</template>)
              </div>
              <div class="text-body-2 text-medium-emphasis">{{ drillEntry.assessment.rationale }}</div>
              <div v-if="drillEntry.assessment.isProgression" class="text-caption mt-1">
                I–R-M: {{ drillEntry.assessment.irmA }} → {{ drillEntry.assessment.irmB }} — gerichtete Progression.
              </div>
            </div>
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn color="success" prepend-icon="mdi-check" @click="decide('confirmed')">Bestätigen</v-btn>
            <v-btn color="error" prepend-icon="mdi-close" @click="decide('rejected')">Verwerfen</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </template>

    <!-- Berichte-Ansicht: Exporte aus dem Mapping (ehemals Reporting-Stub) -->
    <template v-if="sectionTab === 'reports'">
      <v-card variant="outlined" class="pa-4">
        <div class="text-subtitle-1 font-weight-bold mb-1">Berichte &amp; Exporte</div>
        <p class="text-body-2 text-medium-emphasis mb-4">
          Export des Curriculum-Mapping-Berichts (JSON) für AACSB-Dokumentation und abrasive Hyper Actors je Programm.
          Alle Daten bleiben im Backend als versionierter Registry-ENTS extended.
        </p>
        <div class="d-flex flex-wrap ga-2">
          <v-btn color="primary" prepend-icon="mdi-download" @click="exportMappingJson">Mapping-Report (JSON)</v-btn>
          <v-btn variant="outlined" prepend-icon="mdi-download" @click="exportLearningCycleCsv">Learning Cycles (CSV)</v-btn>
        </div>
      </v-card>
    </template>
  </v-container>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  useConstructiveAlignment,
} from '@/composables/useConstructiveAlignment'
import { useContentMapping } from '@/composables/useContentMapping'
import type { OverlapEntryLike } from '@/composables/useContentMapping'
import AssurancePanels from '@/components/AssurancePanels.vue'
import PipelineStepper, { type StepKey, type StepState } from '@/components/curriculum/PipelineStepper.vue'

const router = useRouter()

/* Einheitliche Pipeline-Leiste — Review-Ansicht: aktiver Schritt = "Review" */
const STEP_KEYS: StepKey[] = ['import', 'build', 'confirm', 'assess', 'explain']
const stepperStates = computed<Record<StepKey, StepState>>(() => ({
  import: 'done',
  build: 'idle',
  confirm: 'idle',
  assess: 'idle',
  explain: 'active',
}))

function onStepClick(key: StepKey): void {
  // Schritte 1-4 leben in der CurriculumImport-Ansicht (/curriculum) — dorthin navigieren
  if (key === 'explain') return
  void router.push({ path: '/curriculum', query: { step: key } })
}

const {
  programs,
  loading,
  error,
  selectedProgramId,
  load,
  programName,
  moduleName,
  programModules,
  themesInProgram,
  modulesByTheme,
} = useConstructiveAlignment()

// Content-Mapping (Overlap & Alignment via /api/mapping/*)
const {
  matrixRows,
  openOverlaps,
  cycles: mappingCycles,
  mode: mappingMode,
  loading: mappingLoading,
  refresh: refreshMapping,
  colorOf,
  descriptionOf,
  cyclesFor,
  review,
} = useContentMapping()

const sectionTab = ref<'themes' | 'overlap' | 'alignment' | 'reports'>('themes')
const alignmentSubtab = ref<'matrix' | 'rubrics' | 'aol' | 'loop'>('matrix')
const drillOpen = ref(false)
const drillEntry = ref<OverlapEntryLike | null>(null)
const drillSides = ref<LearningCycleLite[]>([])

interface LearningCycleLite {
  cycleId: string
  moduleId: string
  structuralElement: string
  learningGoals: string
  mainContent: string
  didactics: string
  assignmentDescription?: string
  assignmentType?: string
  level?: string
}

const drillPairReadable = computed(() =>
  drillEntry.value ? `${drillEntry.value.cycleAId} × ${drillEntry.value.cycleBId}` : ''
)
const drillDesc = computed(() =>
  drillEntry.value ? descriptionOf(drillEntry.value.assessment.relationship) : ''
)

function drill(pair: { entries: OverlapEntryLike[] }) {
  const first = pair.entries[0]
  if (first) drillEntryRaw(first)
}

function drillEntryRaw(entry: OverlapEntryLike) {
  drillEntry.value = entry
  const { a, b } = cyclesFor(entry)
  drillSides.value = [[a, b].filter(x => !!x)] as unknown as LearningCycleLite[]
  drillOpen.value = true
}

async function runMapping() {
  await refreshMapping(selectedProgramId.value ?? undefined)
}

function decide(decision: 'confirmed' | 'rejected') {
  if (!drillEntry.value) return
  void review(drillEntry.value.id, decision)
    .then(() => {
      drillOpen.value = false
      void runMapping()
    })
    .catch((err: any) => {
      console.error(err.message)
    })
}

// ---------- Kap. 18 Berichte: Export aus Mapping-Report & Bestand ----------

async function exportMappingJson(): Promise<void> {
  try {
    const cyclesResp = await fetch('/api/curriculum_modules')
    const modulesJson = await cyclesResp.json()
    const cycles = (modulesJson as any[]).flatMap((m: any) => (m.learningCycles ?? []).map((lc: any) => ({ ...lc, moduleId: m.id, semester: m.semester })))
    const res = await fetch('/api/mapping/analyze', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cycles, program: 'prog-dba' }),
    })
    const report = await res.json()
    triggerDownload(JSON.stringify(report, null, 2), 'curriculum-mapping-report.json', 'application/json')
  } catch (err: any) {
    console.error(err.message)
  }
}

async function exportLearningCycleCsv(): Promise<void> {
  try {
    const rows = await fetch('/api/learning_cycles').then(r => r.json())
    if (!Array.isArray(rows) || rows.length === 0) return
    const headers = Object.keys(rows[0] as Record<string, unknown>)
    const csv = [
      headers.join(','),
      ...(rows as Record<string, unknown>[]).map(r => headers.map(h => '"' + String(r[h] ?? '').replace(/"/g, '""') + '"').join(',')),
    ].join('\n')
    triggerDownload(csv, 'learning-cycles.csv', 'text/csv')
  } catch (err: any) {
    console.error(err.message)
  }
}

function triggerDownload(content: string, fileName: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

// ---------- Themenfeld-Zuordnung per Drag & Drop ----------
const assignedDragOver = ref<string | null>(null)

/** noch nirgendwo zugeordnete Module des Programms (TRPU source: modules-entities) */
const unassignedModules = computed(() =>
  programModules.value.filter(m => !(m.strategic_theme_ids ?? []).length),
)

let dragPayload: { moduleId: string; fromThemeId?: string } | null = null

function onAssignDragStartModule(m: MappingModuleMirror, evt: DragEvent): void {
  dragPayload = { moduleId: m._id }
  evt.dataTransfer?.setData('text/plain', m._id)
}

type MappingModuleMirror = { _id: string; credits?: number; strategic_theme_ids?: string[] }

function onChipDragStart(m: MappingModuleMirror, fromThemeId: string, evt: DragEvent): void {
  dragPayload = { moduleId: m._id, fromThemeId }
  evt.dataTransfer?.setData('text/plain', m._id)
}

async function assignDrop(theme: { _id: string }, evt: DragEvent): Promise<void> {
  assignedDragOver.value = null
  const moduleId = evt.dataTransfer?.getData('text/plain') ?? dragPayload?.moduleId
  if (!moduleId) return
  const fromThemeId = dragPayload?.fromThemeId
  dragPayload = null
  await updateThemeAssignment(moduleId, fromThemeId, theme._id)
}

async function unassignFromTheme(moduleId: string, themeId: string): Promise<void> {
  await updateThemeAssignment(moduleId, themeId, undefined)
}

/** PUT /api/modules/<id> mit aktualisierter strategic_theme_ids-Liste */
async function updateThemeAssignment(moduleId: string, fromThemeId?: string, toThemeId?: string): Promise<void> {
  const module = programModules.value.find(m => m._id === moduleId)
  if (!module) return
  const ids = new Set(module.strategic_theme_ids ?? [])
  if (fromThemeId) ids.delete(fromThemeId)
  if (toThemeId) ids.add(toThemeId)
  await fetch(`/api/modules/${encodeURIComponent(moduleId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ strategic_theme_ids: [...ids] }),
  })
  await load()
}

onMounted(() => {
  load()
})

watch(selectedProgramId, () => {
  // recompute handled by composables; no extra action needed
})
</script>

<style scoped>
.irm-table th.irm-col {
  white-space: normal;
  vertical-align: bottom;
  max-width: 110px;
  font-weight: 600;
}
/* Einheitlicher Kopf wie CurriculumMappingPage (Fraunces-Serif-Titel + Creme-Band) */
.curriculum-page {
  background: var(--cw-bg, #f6f4ee);
  min-height: 100vh;
  padding-top: 12px;
}
.page-title {
  font-family: 'Fraunces', serif;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--cw-text, #1e211d);
}
</style>
<style scoped>
.pool-card { cursor: grab; }
.theme-tile-assigned { background: rgba(25,118,210,0.05); }
.theme-card { min-height: 240px; }
.theme-card.drop-over { outline: 2px dashed #1976d2; background: rgba(25,118,210,0.06); }
</style>