<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useCoverage, COVERAGE_SCALE, COVERAGE_LEVEL_ORDER, type MatrixRow } from '@/composables/useCoverage'
import type { CoverageLevel, CoverageRow } from '@/types/coverage'

/**
 * Traceability, Abdeckung und Lücken in einer Ansicht — drei Renderings auf
 * denselben Daten (docs/curriculum-mapping-visualizations.md).
 * Reihenfolge: Scoping-Filter → Matrix → Kennzahlen → Lücken.
 */
const cov = useCoverage()

/** Darstellung 1/2/3 als Tabs. */
const tab = ref<'matrix' | 'metrics' | 'gaps'>('matrix')
/** Tabellen-Fallback — für alle drei Darstellungen Pflicht, nicht optional. */
const showTable = ref(false)
const saving = ref(false)

const isMatrix = computed(() => tab.value === 'matrix')
const isGaps = computed(() => tab.value === 'gaps')
const isMetrics = computed(() => tab.value === 'metrics')

const scale = COVERAGE_SCALE

function levelClass(level: CoverageLevel | null): string {
  return level ? scale[level].className : 'cov-empty'
}

function levelLabel(level: CoverageLevel | null): string {
  return level ? scale[level].label : 'Nicht verknüpft'
}

function levelShort(level: CoverageLevel | null): string {
  return level ? scale[level].short : '–'
}

/** Tooltip pro Zelle (Pflicht laut Abschnitt 2: Modul, Kompetenz, Stufe, Nachweis-Verweis). */
function cellTooltip(row: MatrixRow, competencyName: string, cell: MatrixRow['cells'][string] | undefined): string {
  const parts = [`Modul: ${row.moduleName}`, `Kompetenz: ${competencyName}`, `Stufe: ${levelLabel(cell?.level ?? null)}`]
  if (cell?.level === 'assessed') {
    const proof = cell.proofOfCompetencyId ? cov.proofsById.value.get(cell.proofOfCompetencyId) : undefined
    parts.push(`Nachweis: ${proof?.name ?? 'automatisch abgeleitet'}`)
    parts.push('Klicken: Stufe ändern (introduced/reinforced)')
  } else if (cell?.level) {
    parts.push('Klicken: Stufe zyklen — assessed wird automatisch aus dem Kompetenznachweis gesetzt')
  } else {
    parts.push('Klicken: Kompetenz als eingeführt verknüpfen')
  }
  return parts.join('\n')
}

/** Status-Badge — nie Farbe allein, immer Icon + Label (Abschnitt 4). */
function gapBadge(row: CoverageRow): { icon: string; label: string; color: string } | null {
  if (row.gapStatus === 'critical') return { icon: 'mdi-alert-octagon-outline', label: 'Keine Abdeckung', color: 'error' }
  if (row.gapStatus === 'warning') return { icon: 'mdi-alert-circle-outline', label: 'Nie geprüft', color: 'warning' }
  return { icon: 'mdi-check-circle-outline', label: 'Abgedeckt und geprüft', color: 'success' }
}

function badgeIcon(row: CoverageRow): string {
  return gapBadge(row)!.icon
}

function badgeLabel(row: CoverageRow): string {
  return gapBadge(row)!.label
}

function badgeColor(row: CoverageRow): string {
  return gapBadge(row)!.color
}

/** Balkenbreiten relativ zur maximalen Abdeckung der aktuellen Auswahl. */
const maxTotal = computed(() => Math.max(1, ...cov.visibleMetricRows.value.map(r => r.total)))

function barWidth(count: number): string {
  return `${(count / maxTotal.value) * 100}%`
}

async function applyLevel(moduleId: string, competencyId: string, level: CoverageLevel | null): Promise<void> {
  if (saving.value) return
  saving.value = true
  try {
    await cov.saveLink(moduleId, competencyId, level)
  } catch (e: any) {
    cov.error.value = e?.message ?? 'Speichern fehlgeschlagen'
  } finally {
    saving.value = false
  }
}

/** Menüeinträge pro Zelle — 'assessed' bewusst nicht wählbar (automatisch aus dem Nachweis). */
const levelChoices: Array<{ title: string; level: CoverageLevel | null }> = [
  { title: 'Nicht verknüpft', level: null },
  { title: COVERAGE_SCALE.introduced.label, level: 'introduced' },
  { title: COVERAGE_SCALE.reinforced.label, level: 'reinforced' },
]

const metricHeaders = [
  { title: 'Kompetenz', key: 'name', sortable: false },
  { title: 'Abdeckung', key: 'bar', sortable: false },
  { title: 'Eingeführt', key: 'introducedCount', sortable: true },
  { title: 'Vertieft', key: 'reinforcedCount', sortable: true },
  { title: 'Geprüft', key: 'assessedCount', sortable: true },
  { title: 'Total', key: 'total', sortable: true },
  { title: 'Status', key: 'gapStatus', sortable: false },
]

function onSortClick(key: string): void {
  if (key === 'bar' || key === 'gapStatus' || key === 'name') return
  cov.toggleSort(key as 'total' | 'introducedCount' | 'reinforcedCount' | 'assessedCount' | 'name')
}

const matrixTableHeaders = ['Modul', 'Kompetenz', 'Rahmen', 'Stufe']

const metricTableRows = computed<CoverageRow[]>(() => cov.visibleMetricRows.value.map(r => ({
  ...r,
})))

watch(() => [cov.selectedProgram.value, cov.selectedFramework.value], () => { void cov.fetchCoverage() })

onMounted(async () => {
  await cov.fetchProgramOptions()
  await cov.fetchCoverage()
})
</script>

<template>
  <v-container fluid class="app-bg">
    <div class="view-hero d-flex flex-wrap align-center justify-space-between ga-4">
      <div>
        <h1 class="text-h4 font-weight-bold">Abdeckung &amp; Traceability</h1>
        <div class="text-body-2 opacity-90">
          Modul ↔ Kompetenz — Traceability-Matrix, Abdeckungs-Kennzahlen und Lücken auf einer Datenquelle
        </div>
      </div>
      <div class="d-flex align-center ga-2">
        <v-chip prepend-icon="mdi-book-open-page-variant" variant="tonal" color="white" size="small">
          {{ cov.modules.value.length }} Module
        </v-chip>
        <v-chip prepend-icon="mdi-sitemap" variant="tonal" color="white" size="small">
          {{ cov.competencies.value.length }} Kompetenzen
        </v-chip>
        <v-btn icon="mdi-refresh" variant="tonal" color="white" size="small" :loading="cov.loading.value" @click="cov.fetchCoverage()">
          <v-tooltip activator="parent">Neu laden</v-tooltip>
        </v-btn>
      </div>
    </div>

    <v-alert v-if="cov.error.value" type="error" variant="tonal" class="mb-4" closable @click:close="cov.error.value = null">
      {{ cov.error.value }}
    </v-alert>

    <!-- Scoping-Filter: zwingend oberhalb der Matrix (Programm / Kompetenzrahmen) -->
    <v-card variant="outlined" class="pa-4 mb-4">
      <div class="d-flex flex-wrap align-center ga-4">
        <v-select
          v-model="cov.selectedProgram.value"
          :items="cov.programs.value"
          item-title="name"
          item-value="id"
          label="Programm"
          style="max-width: 260px"
          clearable
        />
        <v-select
          v-model="cov.selectedFramework.value"
          :items="cov.frameworks.value"
          item-title="name"
          item-value="id"
          label="Kompetenzrahmen"
          style="max-width: 260px"
          clearable
        />
        <v-spacer />
        <div class="text-caption text-medium-emphasis">
          {{ cov.data.value?.scope.moduleCount ?? 0 }} Module ·
          {{ cov.data.value?.scope.competencyCount ?? 0 }} Kompetenzen im Filter
        </div>
      </div>
    </v-card>

    <v-card variant="outlined" class="mb-4">
      <div class="d-flex flex-wrap align-center pa-2 ga-2">
        <v-tabs v-model="tab" density="compact" color="primary">
          <v-tab value="matrix">
            <v-icon start>mdi-table</v-icon>Traceability-Matrix
          </v-tab>
          <v-tab value="metrics">
            <v-icon start>mdi-chart-bar</v-icon>Abdeckungs-Kennzahlen
          </v-tab>
          <v-tab value="gaps">
            <v-icon start>mdi-alert-circle-outline</v-icon>Lücken
            <v-chip v-if="cov.gapRows.value.length" size="x-small" color="error" class="ml-2">
              {{ cov.gapRows.value.length }}
            </v-chip>
          </v-tab>
        </v-tabs>
        <v-spacer />
        <!-- Tabellen-Fallback ist Pflicht (Barrierefreiheit), für alle drei Darstellungen -->
        <v-btn-toggle v-model="showTable" density="compact" variant="outlined" mandatory>
          <v-btn value="false" size="small" prepend-icon="mdi-view-grid">Visualisierung</v-btn>
          <v-btn value="true" size="small" prepend-icon="mdi-table">Tabelle</v-btn>
        </v-btn-toggle>
      </div>
    </v-card>
<!-- ============ Darstellung 1: Traceability-Matrix ============ -->
    <template v-if="isMatrix">
      <!-- Legende ist Pflicht: drei bedeutungstragende Stufen dürfen nicht allein über Farbintensität unterschieden werden -->
      <v-card variant="outlined" class="mb-4 pa-4">
        <div class="d-flex flex-wrap align-center justify-space-between ga-4">
          <div>
            <div class="text-subtitle-1 font-weight-bold">Legende</div>
            <div class="text-caption text-medium-emphasis">Ordinale Skala — eine Farbfamilie, drei Helligkeitsstufen</div>
          </div>
          <div class="d-flex align-center flex-wrap ga-5">
            <div v-for="l in COVERAGE_LEVEL_ORDER" :key="l" class="d-flex align-center ga-2">
              <span class="cov-swatch" :class="scale[l].className">{{ scale[l].short }}</span>
              <div class="text-caption">
                <div class="font-weight-bold">{{ scale[l].label }}</div>
              </div>
            </div>
            <div class="d-flex align-center ga-2">
              <span class="cov-swatch cov-empty">–</span>
              <div class="text-caption">
                <div class="font-weight-bold">Nicht verknüpft</div>
              </div>
            </div>
          </div>
        </div>
      </v-card>

      <v-card v-if="!showTable && cov.matrixRows.value.length" variant="outlined">
        <div class="matrix-scroll pa-2">
          <v-table density="compact" class="coverage-matrix">
            <thead>
              <tr>
                <th class="matrix-module-head">Modul</th>
                <template v-for="group in cov.columnGroups.value" :key="group.frameworkId">
                  <tr>
                    <th :colspan="group.columns.length" class="matrix-framework-head">{{ group.name }}</th>
                  </tr>
                  <tr>
                    <th v-for="col in group.columns" :key="col.competencyId" class="matrix-competency-head">
                      <v-tooltip :text="col.name" location="bottom">
                        <template #activator="{ props }">
                          <span v-bind="props" class="matrix-competency-label">{{ col.name }}</span>
                        </template>
                      </v-tooltip>
                    </th>
                  </tr>
                </template>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in cov.matrixRows.value" :key="row.moduleId">
                <th class="sticky-col matrix-module-cell text-left">
                  <div class="text-body-2 font-weight-bold">{{ row.moduleName }}</div>
                  <div class="text-caption text-medium-emphasis">
                    <span v-if="row.code">{{ row.code }} · </span>Semester {{ row.semester ?? '–' }}
                  </div>
                </th>
                <td v-for="col in cov.matrixColumns.value" :key="col.competencyId" class="text-center matrix-cell">
                  <v-tooltip location="top" max-width="340">
                    <template #activator="{ props }">
                      <v-menu>
                        <template #activator="{ props: menuProps }">
                          <button
                            v-bind="{ ...menuProps, ...props }"
                            type="button"
                            class="cov-cell"
                            :class="levelClass(row.cells[col.competencyId]?.level ?? null)"
                            :aria-label="`${row.moduleName}: ${col.name}, ${levelLabel(row.cells[col.competencyId]?.level ?? null)}`"
                            :disabled="saving"
                            @click="applyLevel(row.moduleId, col.competencyId, cov.nextLevel(row.cells[col.competencyId]?.level ?? null, !!row.cells[col.competencyId]?.assessedFromProof))"
                          >
                            <span class="cov-cell-text">{{ levelShort(row.cells[col.competencyId]?.level ?? null) }}</span>
                          </button>
                        </template>
                        <v-list density="compact">
                          <v-list-subheader>Abdeckungsstufe</v-list-subheader>
                          <v-list-item
                            v-for="opt in levelChoices"
                            :key="opt.title"
                            :title="opt.title"
                            :active="opt.level === (row.cells[col.competencyId]?.level ?? null)"
                            :prepend-icon="opt.level ? scale[opt.level].short : 'mdi-minus'"
                            @click="applyLevel(row.moduleId, col.competencyId, opt.level)"
                          />
                          <v-list-item
                            v-if="row.cells[col.competencyId]?.assessedFromProof"
                            :title="`Nachweis: ${cov.proofsById.value.get(row.cells[col.competencyId]?.proofOfCompetencyId ?? '')?.name ?? 'automatisch'}`"
                            prepend-icon="mdi-file-certificate-outline"
                            class="cov-assessed-hint"
                          />
                        </v-list>
                      </v-menu>
                    </template>
                    <div class="text-caption" style="white-space: pre-line">{{ cellTooltip(row, col.name, row.cells[col.competencyId]) }}</div>
                  </v-tooltip>
                </td>
              </tr>
            </tbody>
          </v-table>
        </div>
      </v-card>

      <!-- Tabellen-Fallback: Pflicht aus Zugänglichkeitsgründen -->
      <v-card v-else-if="showTable && cov.matrixTableRows.value.length" variant="outlined">
        <v-table density="compact">
          <thead>
            <tr>
              <th v-for="h in matrixTableHeaders" :key="h" class="text-left">{{ h }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in cov.matrixTableRows.value" :key="row.id">
              <td>{{ row.moduleName }}</td>
              <td>{{ row.competencyName }}</td>
              <td>{{ row.frameworkName }}</td>
              <td>
                <v-chip size="small" variant="flat" :class="levelClass(row.level)">{{ levelLabel(row.level) }}</v-chip>
                <div v-if="row.assessedFromProof" class="text-caption text-medium-emphasis">
                  <v-icon size="x-small">mdi-file-certificate-outline</v-icon>
                  {{ row.proofName ?? 'automatisch abgeleitet' }}
                </div>
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-card>

      <v-alert v-else type="info" variant="tonal">
        Keine Verknüpfungen vorhanden. Bitte Scoping-Filter prüfen oder Kompetenzen den Lernzyklus-Inhalten in der Modules-Ansicht zuordnen.
      </v-alert>
    </template>

    <!-- ============ Darstellung 2 + 3: Kennzahlen und Lücken ============ -->
    <template v-else>
      <v-card v-if="isGaps" variant="outlined" class="mb-4 pa-4">
        <div class="d-flex flex-wrap align-center ga-4">
          <v-switch v-model="cov.gapsOnly.value" color="primary" hide-details inset label="Nur Lücken anzeigen" />
          <v-spacer />
          <v-chip prepend-icon="mdi-alert-octagon-outline" color="error" variant="tonal" size="small">
            Keine Abdeckung: {{ cov.gapSummary.value.critical }}
          </v-chip>
          <v-chip prepend-icon="mdi-alert-circle-outline" color="warning" variant="tonal" size="small">
            Nie geprüft: {{ cov.gapSummary.value.warning }}
          </v-chip>
          <v-chip prepend-icon="mdi-check-circle-outline" color="success" variant="tonal" size="small">
            Abgedeckt: {{ cov.gapSummary.value.ok }}
          </v-chip>
        </div>
      </v-card>

      <v-alert v-if="isGaps && !cov.gapRows.value.length" type="success" variant="tonal" class="mb-4" prepend-icon="mdi-check-circle-outline">
        Keine Lücken: jede Kompetenz ist abgedeckt und wird geprüft.
      </v-alert>

      <!-- Gestapelte Balken, aufsteigend nach Gesamtabdeckung: schwächste Kompetenzen oben -->
      <v-card v-if="!showTable && cov.visibleMetricRows.value.length" variant="outlined">
        <v-table density="compact">
          <thead>
            <tr>
              <th
                v-for="h in metricHeaders"
                :key="h.key"
                class="text-left"
                :class="{ 'metric-sortable': h.sortable }"
                @click="onSortClick(h.key)"
              >
                {{ h.title }}
                <v-icon v-if="h.sortable && cov.sortKey.value === h.key" size="x-small">
                  {{ cov.sortAscending.value ? 'mdi-arrow-up' : 'mdi-arrow-down' }}
                </v-icon>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in cov.visibleMetricRows.value" :key="row.competencyId">
              <td>
                <div class="text-body-2 font-weight-bold">{{ row.name }}</div>
                <div class="text-caption text-medium-emphasis">{{ cov.frameworkName(row.frameworkId) }}</div>
              </td>
              <td style="min-width: 220px">
                <div class="coverage-bar" :aria-label="`${row.name}: ${row.total} Module abgedeckt`">
                  <span v-if="row.assessedCount" class="coverage-seg cov-assessed" :style="{ width: barWidth(row.assessedCount) }" :title="`${row.assessedCount} geprüft`" />
                  <span v-if="row.reinforcedCount" class="coverage-seg cov-reinforced" :style="{ width: barWidth(row.reinforcedCount) }" :title="`${row.reinforcedCount} vertieft`" />
                  <span v-if="row.introducedCount" class="coverage-seg cov-introduced" :style="{ width: barWidth(row.introducedCount) }" :title="`${row.introducedCount} eingeführt`" />
                </div>
              </td>
              <td>{{ row.introducedCount }}</td>
              <td>{{ row.reinforcedCount }}</td>
              <td>{{ row.assessedCount }}</td>
              <td class="font-weight-bold">{{ row.total }}</td>
              <td>
                <v-chip size="small" variant="tonal" :color="badgeColor(row)" :prepend-icon="badgeIcon(row)" class="text-none">
                  {{ badgeLabel(row) }}
                </v-chip>
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-card>

      <!-- Tabellen-Fallback (Pflicht, auch für Kennzahlen und Lücken) -->
      <v-card v-else-if="showTable" variant="outlined">
        <v-table density="compact">
          <thead>
            <tr>
              <th v-for="h in metricHeaders" :key="h.key" class="text-left">{{ h.title }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in metricTableRows" :key="row.competencyId">
              <td>{{ row.name }}</td>
              <td>—</td>
              <td>{{ row.introducedCount }}</td>
              <td>{{ row.reinforcedCount }}</td>
              <td>{{ row.assessedCount }}</td>
              <td class="font-weight-bold">{{ row.total }}</td>
              <td>
                <v-chip size="small" variant="tonal" :prepend-icon="badgeIcon(row)">{{ badgeLabel(row) }}</v-chip>
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-card>

      <v-alert v-else-if="isMetrics" type="info" variant="tonal">
        Keine Kompetenzen im aktuellen Scoping-Filter.
      </v-alert>
    </template>
  </v-container>
</template>

<style scoped>
/* Ordinale Farbskala: EINE Hue, drei Helligkeitsstufen (hell → mittel → dunkel). */
.cov-introduced { background: #cfe0f5; color: #102230; }
.cov-reinforced { background: #6f9fd8; color: #ffffff; }
.cov-assessed { background: #15489b; color: #ffffff; }
/* Leere Zelle = keine Verknüpfung = neutrale Oberflächenfarbe, keine Sonderfarbe. */
.cov-empty { background: #f2f5f9; color: #9aa7b5; }

.cov-swatch {
  display: inline-block;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  border: 1px solid rgba(16, 34, 48, .14);
}

.cov-cell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 34px;
  height: 28px;
  border: 1px solid rgba(16, 34, 48, .12);
  border-radius: 6px;
  font-size: .74rem;
  font-weight: 700;
  cursor: pointer;
  transition: transform .12s, box-shadow .12s;
}
.cov-cell:hover { transform: translateY(-1px); box-shadow: 0 3px 8px rgba(16, 34, 48, .18); }
.cov-cell:focus-visible { outline: 2px solid var(--v-theme-primary); outline-offset: 1px; }

.matrix-scroll { overflow: auto; max-height: 70vh; }
.coverage-matrix { table-layout: fixed; min-width: 100%; }
.coverage-matrix th, .coverage-matrix td { padding: 2px 4px; }

.matrix-module-head, .sticky-col {
  position: sticky;
  left: 0;
  z-index: 2;
  background: var(--v-theme-surface-bright);
  min-width: 220px;
}
.matrix-module-head { z-index: 3; }
.matrix-module-cell { vertical-align: top; }
.matrix-competency-head { vertical-align: bottom; min-width: 34px; }
.matrix-competency-label {
  display: inline-block;
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  white-space: nowrap;
  font-size: .68rem;
  max-height: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.matrix-framework-head {
  text-align: center;
  font-size: .72rem;
  text-transform: uppercase;
  letter-spacing: .08em;
  border-bottom: 1px solid rgba(0, 0, 0, .12);
}

.coverage-bar {
  display: flex;
  height: 14px;
  border-radius: 7px;
  overflow: hidden;
  background: var(--v-theme-surface-variant);
}
.coverage-seg { display: block; height: 100%; }

.metric-sortable { cursor: pointer; user-select: none; }
.cov-assessed-hint { opacity: .7; font-size: .74rem; }
</style>
