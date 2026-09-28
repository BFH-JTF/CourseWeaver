<template>
  <div class="curriculum-page">
    <v-container fluid>
      <!-- Screenshot 1: Titelzeile + Aktion "Daten importieren" (kein separater Mapping-Button, Kap. Pipeline-Navigation) -->
      <div class="d-flex align-center justify-space-between mb-1 flex-wrap">
        <div>
          <h1 class="page-title mb-1">Curriculum Mapping</h1>
          <div class="text-body-2 text-medium-emphasis">
            {{ visibleModules.length }} Module · {{ totalSemesters }} Semester · {{ totalCycles }} Learning Cycles importiert
          </div>
        </div>
        <div>
          <v-btn variant="outlined" color="accent" prepend-icon="mdi-tray-arrow-down" @click="importOpen = true">
            Daten importieren
          </v-btn>
        </div>
      </div>

      <!-- Pipeline-Navigation: alle 5 Schritte klickbar zu den jeweiligen Ansichten (Kap. 2.1) -->
      <PipelineStepper
        :states="stepperStates"
        :clickable-steps="STEP_KEYS"
        class="my-4"
        @step-click="onStepClick"
      />

      <v-alert
        v-if="candidateInfo"
        type="info"
        variant="tonal"
        density="compact"
        class="mb-4"
        data-test="candidate-summary"
      >
        {{ candidateInfo }}
      </v-alert>
      <v-alert v-if="errorInfo" type="error" variant="tonal" density="compact" class="mb-4">
        {{ errorInfo }}
      </v-alert>

      <!-- ============ Ansicht 1: "Import" ============
           Übersicht über die importierten Module/ LCs (Semester-Akkordeons) -->
      <template v-if="activeStep === 'import'">
        <v-row>
          <v-col cols="12" md="3">
            <v-card variant="outlined" class="versions-card pa-3">
              <div class="text-subtitle-1 font-weight-bold" style="font-family: serif-headline">Curriculum-Versionen</div>
              <div class="text-caption text-medium-emphasis mt-1">Noch keine Version vorhanden</div>
            </v-card>
          </v-col>

          <v-col cols="12" md="9">
            <h2 v-if="programTitle" class="program-title text-h6 mb-3">{{ programTitle }}</h2>

            <template v-for="section in semesterSections" :key="section.semester">
              <SemesterSection
                :semester="section.semester"
                :expanded="expandedSemesters[String(section.semester)] !== false"
                :expanded-module-ids="expandedModuleIds"
                :expanded-cycle-ids="expandedCycleIds"
                :manual-expanded-cycles="manualExpandedCycles"
                :modules="section.modules"
                @toggle="toggleSemester(section.semester)"
                @toggle-module="toggleModule"
                @toggle-more-cycles="toggleMoreCycles"
                @toggle-cycle="toggleCycle"
              />
            </template>
          </v-col>
        </v-row>
      </template>

      <!-- ============ Ansicht 2: "Kandidaten bauen" ============
           Screenshot 1: günstiger Filterschritt (Embeddings, keine LLM-Calls) -->
      <template v-else-if="activeStep === 'build'">
        <v-card variant="outlined" class="pa-4" style="border-color: var(--cw-border, #e3dfd3); background: transparent;">
          <div class="text-subtitle-1 font-weight-bold mb-1" style="font-family: 'Fraunces', serif;">Kandidaten bauen</div>
          <div class="text-body-2 text-medium-emphasis mb-4">
            Filtert günstig (nur Embeddings, keine LLM-Aufrufe) auf eine kleine Menge plausibler Paare:
            Lernziel + Hauptinhalt je Learning Cycle embedden, paarweise Cosinus-Ähnlichkeit berechnen,
            pro LC nur die Top-5 über Schwellenwert behalten, Duplikate und Paare aus demselben Modul entfernen.
          </div>

          <v-alert v-if="running" type="info" variant="tonal" density="compact" class="mb-4">
            Kandidaten-Suche läuft...
          </v-alert>

          <template v-if="lastCandidates">
            <div class="text-body-1 mb-4">
              <strong>{{ lastCandidates.candidateCount }}</strong> Kandidatenpaare zu
              <strong>{{ lastCandidates.alignmentCandidateCount }}</strong> Alignment-Kandidaten ({{ modusLabel }})
            </div>
            <v-btn color="coral" class="llm-button" prepend-icon="mdi-arrow-right" @click="goToConfirm">
              Weiter zu "Kandidaten prüfen" ({{ selectedCount }} aangewählt)
            </v-btn>
          </template>
          <v-btn
            v-else-if="!running"
            color="coral"
            class="llm-button"
            prepend-icon="mdi-filter-outline"
            @click="runCandidates"
          >
            Kandidaten bauen
          </v-btn>
        </v-card>
      </template>

      <!-- ============ Ansicht 3: "Kandidaten prüfen" ============
           Screenshot 2: Paare ansehen, ab-/anwählen, manuell ergänzen, dann weiter -->
      <CandidateReview
        v-else-if="activeStep === 'confirm'"
        :candidates="reviewEntries"
        :lexical-mode="reviewLexical"
        :cycles="reviewCycleItems"
        @cancel="activeStep = 'build'"
        @add-manual="addManualPair"
        @remove-pair="removePair"
        @continue="activeStep = 'assess'"
      />

      <!-- ============ Ansicht 4: "LLM-Bewertung" ============
           Der eigentliche Start der teuren Bewertung — hier statt Button oben rechts -->
      <template v-else-if="activeStep === 'assess'">
        <v-card variant="outlined" class="pa-4" style="border-color: var(--cw-border, #e3dfd3); background: transparent;">
          <div class="text-subtitle-1 font-weight-bold mb-1" style="font-family: 'Fraunces', serif;">LLM-Bewertung</div>
          <div class="text-body-2 text-medium-emphasis mb-4">
            Quickly: Parallel: max. 5 gleichzeitige Calls mit Retry — die Bewertung kann einige Minuten laufen.
          </div>

          <div class="text-body-1 mb-2">
            <strong>{{ selectedCount }}</strong> ausgewählte Paare ·
            <strong>{{ lastCandidates?.alignmentCandidateCount ?? 0 }}</strong> Alignment-Kandidaten
          </div>

          <v-alert v-if="sending" type="info" variant="tonal" density="compact" class="mb-4">
            LLM bewertet die Paare — je nach Modell einige Minuten (Concurrency max. 5, Kap. 7).
          </v-alert>
          <v-alert v-if="selectedCount === 0" type="warning" variant="tonal" density="compact" class="mb-4">
            Keine Paare ausgewählt. Erst unter "Kandidaten prüfen" Paare wählen — oder Schritt 2 und 3 befolgen.
          </v-alert>

          <div class="d-flex ga-2 flex-wrap">
            <v-btn
              color="coral"
              class="llm-button"
              prepend-icon="mdi-robot-outline"
              :disabled="selectedCount === 0 || sending"
              :loading="sending"
              @click="runLlmAssessment"
            >
              LLM-Bewertung starten
            </v-btn>
            <v-btn v-if="lastResult" variant="text" color="accent" prepend-icon="mdi-clipboard-check" @click="openReview()">
              Zu Review öffnen
            </v-btn>
          </div>

          <div v-if="lastResult" class="text-body-2 text-medium-emphasis mt-4">
            Letztes Ergebnis: {{ lastResult.moduleMatrix?.length ?? 0 }} Modulpaare in der Matrix
          </div>
        </v-card>
      </template>

      <!-- ============ Ansicht 5: "Review" → bestehende Matrix-Ansicht (/mapping) ============ -->

      <!-- Daten-Import per Dialog (Mehr-Dateien, Kap Spec 3) -->
      <CsvImportDialog v-model="importOpen" />
    </v-container>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PipelineStepper, { type StepKey, type StepState } from '@/components/curriculum/PipelineStepper.vue'
import CandidateReview, { type CandidatePairEntry } from '@/components/curriculum/CandidateReview.vue'
import SemesterSection from '@/components/curriculum/SemesterSection.vue'
import CsvImportDialog from '@/components/CsvImportDialog.vue'
import type { CurriculumModuleEntry, LearningCycleEntry } from '@/components/curriculum/types'

const STEP_KEYS: StepKey[] = ['import', 'build', 'confirm', 'assess', 'explain']
const router = useRouter()
const route = useRoute()

const loadError = ref<string | null>(null)
const running = ref(false)
const sending = ref(false)
const importOpen = ref(false)

/* Kap. 2.1 — Status + Fehlermeldungen */
const candidateInfo = ref<string | null>(null)
const errorInfo = ref<string | null>(null)

const modules = ref<CurriculumModuleEntry[]>([])
const selectedProgramId = ref<string | null>(null)

/* Aktive Pipeline-Stufe (Stepper-Navigation) */
const activeStep = ref<StepKey>('import')

/* Header-Zähler */
const visibleModules = computed(() =>
  modules.value.filter(m => !selectedProgramId.value || m.studyProgramId === selectedProgramId.value),
)
const totalSemesters = computed(() => semesterSections.value.length)
const totalCycles = computed(() =>
  visibleModules.value.reduce((acc, m) => acc + (m.learningCycles?.length ?? 0), 0),
)

const programTitle = computed<string>(() => {
  if (selectedProgramId.value) {
    return modules.value.find(m => m.studyProgramId === selectedProgramId.value)?.studyProgramId ?? ''
  }
  return visibleModules.value[0]?.studyProgramId ?? ''
})

/* ============================ Pipeline-Daten ============================ */

interface CandidatesResponse {
  candidateCount: number
  alignmentCandidateCount: number
  overlapCandidates: Array<{ cycleAId: string; cycleBId: string; embeddingSimilarity: number }>
  alignmentCandidates: Array<{ cycleId: string }>
  mode: 'embedding' | 'lexical'
  embeddingStats?: { total: number; cached: number; computed: number; modelId: string | null }
}

const lastCandidates = ref<CandidatesResponse | null>(null)
const lastResult = ref<{ generatedAt?: string; moduleMatrix?: unknown[] } | null>(null)
const reviewLexical = ref(false)
const reviewEntries = ref<CandidatePairEntry[]>([])

const modusLabel = computed(() =>
  lastCandidates.value?.mode === 'lexical' ? 'lexikalischer Modus — ohne Embedding-Server' : 'Embedding-Modus',
)

const selectedCount = computed(() => reviewEntries.value.filter(e => e.selected).length)

const hasData = computed(() => visibleModules.value.length > 0)

/* Stepper-Zustände: erledigt wenn Daten da, 'active' auf der geöffneten Stufe */
const stepperStates = computed<Record<StepKey, StepState>>(() => {
  const states: Record<StepKey, StepState> = {
    import: hasData.value ? 'done' : 'idle',
    build: lastCandidates.value ? 'done' : 'idle',
    confirm: reviewEntries.value.length > 0 ? 'done' : 'idle',
    assess: lastResult.value ? 'done' : 'idle',
    explain: lastResult.value ? 'done' : 'idle',
  }
  states[activeStep.value] = 'active'
  return states
})

function onStepClick(key: StepKey): void {
  errorInfo.value = null
  if (key === 'explain') {
    // Review-Ansicht = bestehende Modul-Matrix (/mapping)
    void router.push('/mapping')
    activeStep.value = 'assess'
    return
  }
  activeStep.value = key
}

/* ---------------------- LC-/Modul-Helfer ---------------------------- */

function collectCycles(): Array<LearningCycleEntry & { moduleId: string; semester: number }> {
  return visibleModules.value.flatMap(m =>
    (m.learningCycles as LearningCycleEntry[]).map(lc => ({ ...lc, moduleId: m.id, semester: m.semester })),
  )
}

function lcTitle(lc: LearningCycleEntry): string {
  return lc.structuralElement || lc.title || 'Learning Cycle'
}

function truncate(text: string, max = 70): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > max ? clean.slice(0, max - 1) + '…' : clean
}

const moduleById = computed(() => {
  const map = new Map<string, CurriculumModuleEntry>()
  for (const m of visibleModules.value) map.set(m.id, m)
  return map
})

function entryFor(lc: LearningCycleEntry, moduleId: string): { name: string; title: string; summary: string } {
  const mod = moduleById.value.get(moduleId)
  return {
    name: mod?.name ?? moduleId,
    title: lcTitle(lc),
    summary: truncate(lc.learningGoals || lc.mainContent || 'keine Beschreibung', 70),
  }
}

function buildReviewEntries(cand: CandidatesResponse, cycles: LearningCycleEntry[]): CandidatePairEntry[] {
  const byId = new Map(cycles.map(c => [c.id, c]))
  const moduleIdByCycleId = new Map(cycles.map(c => [c.id, c.moduleId]))
  const entries: CandidatePairEntry[] = []
  const seen = new Set<string>()
  for (const pair of cand.overlapCandidates) {
    const a = byId.get(pair.cycleAId)
    const b = byId.get(pair.cycleBId)
    if (!a || !b) continue
    const aInfo = entryFor(a, moduleIdByCycleId.get(pair.cycleAId) ?? a.moduleId)
    const bInfo = entryFor(b, moduleIdByCycleId.get(pair.cycleBId) ?? b.moduleId)
    const key = [pair.cycleAId, pair.cycleBId].sort().join('::')
    if (seen.has(key)) continue
    seen.add(key)
    entries.push({
      key,
      aId: pair.cycleAId,
      bId: pair.cycleBId,
      aName: aInfo.name,
      bName: bInfo.name,
      aTitle: aInfo.title,
      bTitle: bInfo.title,
      aSummary: aInfo.summary,
      bSummary: bInfo.summary,
      similarity: pair.embeddingSimilarity ?? null,
      manual: false,
      selected: true,
    })
  }
  return entries.sort((x, y) => (y.similarity ?? 0) - (x.similarity ?? 0))
}

const reviewCycleItems = computed(() =>
  collectCycles().map(lc => ({
    id: lc.id,
    label: lcTitle(lc),
    moduleName: moduleById.value.get(lc.moduleId)?.name ?? lc.moduleId,
  })),
)

/* ---------------------- Stufe 2: Kandidaten bauen -------------------- */

async function runCandidates(): Promise<void> {
  if (running.value) return
  running.value = true
  errorInfo.value = null
  try {
    const cycles = collectCycles()
    if (cycles.length === 0) throw new Error('Keine Learning Cycles vorhanden — bitte zuerst Daten importieren')
    const candRes = await fetch('/api/mapping/candidates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cycles, program: selectedProgramId.value }),
    })
    if (!candRes.ok) throw new Error(`Kandidaten-Suche fehlgeschlagen: HTTP ${candRes.status}`)
    const cand = (await candRes.json()) as CandidatesResponse
    lastCandidates.value = cand
    reviewLexical.value = cand.mode === 'lexical'
    reviewEntries.value = buildReviewEntries(cand, cycles)
    candidateInfo.value = `${cand.candidateCount} Kandidatenpaare gefunden`
  } catch (e: any) {
    errorInfo.value = e?.message || 'Kandidaten-Suche fehlgeschlagen'
  } finally {
    running.value = false
  }
}

/* Parent-Werkbank: Paar entfernen (dieselbe Liste wie add-manual) */
function removePair(pairKey: string): void {
  reviewEntries.value = reviewEntries.value.filter(e => e.key !== pairKey)
}

/* ---------------------- Navigation zwischen den Schritten -------------- */

function goToConfirm(): void {
  activeStep.value = 'confirm'
}

function addManualPair(pair: { cycleAId: string; cycleBId: string }): void {
  const cycles = collectCycles()
  const a = cycles.find(c => c.id === pair.cycleAId)
  const b = cycles.find(c => c.id === pair.cycleBId)
  if (!a || !b) return
  const key = `manual::${pair.cycleAId}::${pair.cycleBId}`
  if (reviewEntries.value.some(e => e.key === key)) return
  const aInfo = entryFor(a, a.moduleId)
  const bInfo = entryFor(b, b.moduleId)
  reviewEntries.value.push({
    key,
    aId: pair.cycleAId,
    bId: pair.cycleBId,
    aName: aInfo.name,
    bName: bInfo.name,
    aTitle: aInfo.title,
    bTitle: bInfo.title,
    aSummary: aInfo.summary,
    bSummary: bInfo.summary,
    similarity: null,
    manual: true,
    selected: true,
  })
  candidateInfo.value = `Paar manuell hinzugefügt (${aInfo.name} × ${bInfo.name})`
}

/* ---------------------- Stufe 3/4: LLM-Bewertung + Review --------------- */

async function runLlmAssessment(): Promise<void> {
  if (sending.value) return
  sending.value = true
  errorInfo.value = null
  try {
    const selectedPairs = reviewEntries.value
      .filter(e => e.selected)
      .map(e => ({ cycleAId: e.aId, cycleBId: e.bId }))
    if (selectedPairs.length === 0) throw new Error('Keine Paare ausgewählt — erst "Kandidaten prüfen"')
    const res = await fetch('/api/mapping/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cycles: collectCycles(),
        program: selectedProgramId.value,
        candidates: {
          overlapCandidates: selectedPairs,
          alignmentCandidates: lastCandidates.value?.alignmentCandidates ?? [],
        },
      }),
    })
    if (!res.ok) throw new Error(`Analyse fehlgeschlagen: HTTP ${res.status}`)
    const result = (await res.json()) as { generatedAt?: string; moduleMatrix?: unknown[] }
    lastResult.value = result
    candidateInfo.value = `Bewertung abgeschlossen — ${(result.moduleMatrix ?? []).length} Modulpaare in der Matrix`
  } catch (e: any) {
    errorInfo.value = e?.message || 'Analyse fehlgeschlagen'
  } finally {
    sending.value = false
  }
}

function openReview(): void {
  void router.push('/mapping')
}

/* ---------------------- Akkordeon-Zustände (Import-Ansicht) ------------- */

const expandedSemesters = ref<Record<string, boolean>>({})
const expandedModuleIds = ref<string[]>([])
const expandedCycleIds = ref<string[]>([])
const manualExpandedCycles = ref<Record<string, boolean>>({})

function toggleSemester(id: number): void {
  const key = String(id)
  expandedSemesters.value[key] = expandedSemesters.value[key] === false
}
function toggleModule(id: string): void {
  expandedModuleIds.value = expandedModuleIds.value.includes(id)
    ? expandedModuleIds.value.filter(x => x !== id)
    : [...expandedModuleIds.value, id]
  if (expandedModuleIds.value.includes(id)) {
    manualExpandedCycles.value[id] = true
  }
}
function toggleMoreCycles(id: string): void {
  manualExpandedCycles.value[id] = manualExpandedCycles.value[id] === false
}
function toggleCycle(id: string): void {
  expandedCycleIds.value = expandedCycleIds.value.includes(id)
    ? expandedCycleIds.value.filter(x => x !== id)
    : [...expandedCycleIds.value, id]
}

/* ---------------------- Daten laden ------------------------------- */

async function loadModules(): Promise<void> {
  loadError.value = null
  try {
    const stored: Record<string, any>[] = await fetch('/api/curriculum_modules').then(r => (r.ok ? r.json() : []))
    if (stored.length) {
      modules.value = (stored as any[]).map(m => ({
        id: m.id,
        name: m.name,
        studyProgramId: m.studyProgramId,
        semester: m.semester ?? 0,
        credits: m.credits,
        learningCycles: (m.learningCycles ?? []) as LearningCycleEntry[],
      }) as CurriculumModuleEntry)
    } else {
      const legacy = (await fetch('/api/learning_cycles').then(r => (r.ok ? r.json() : []))) as any[]
      const byModule = new Map<string, CurriculumModuleEntry>()
      for (const lc of legacy) {
        let mod = byModule.get(lc.moduleId)
        if (!mod) {
          mod = { id: String(lc.moduleId), name: String(lc.moduleId), studyProgramId: 'prog-unknown', semester: 0, learningCycles: [] }
          byModule.set(String(lc.moduleId), mod)
        }
        mod.learningCycles.push(lc as LearningCycleEntry)
      }
      modules.value = [...byModule.values()]
    }
    if (!selectedProgramId.value && modules.value.length) {
      selectedProgramId.value = modules.value[0]!.studyProgramId
    }
  } catch (e: any) {
    loadError.value = e.message || 'Fehler beim Laden'
  }
}

/** ?step= (z. B. aus der Review-Ansicht navigiert) direkt in die gewünschte Ansicht */
function applyStepQuery(): void {
  const q = String(route.query.step ?? '')
  if (!STEP_KEYS.includes(q as StepKey)) return
  if (q === 'explain') return // Review lebt in der /mapping-Ansicht
  activeStep.value = q as Exclude<StepKey, 'explain'>
}
watch(() => route.query.step, applyStepQuery)

onMounted(async () => {
  await loadModules()
  applyStepQuery()
})

const semesterSections = computed(() => {
  const bySem = new Map<number, CurriculumModuleEntry[]>()
  for (const m of visibleModules.value) {
    const key = m.semester ?? 0
    const arr = bySem.get(key) ?? []
    arr.push(m)
    bySem.set(key, arr)
  }
  return [...bySem.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([semester, list]) => ({ semester, modules: list.sort((a, b) => a.name.localeCompare(b.name)) }))
})
</script>

<style scoped>
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
.program-title {
  font-family: 'IBM Plex Sans', sans-serif;
  font-weight: 600;
  color: var(--cw-text, #1e211d);
}
</style>
