<template>
  <div>
    <v-window v-model="activeTab">
      <v-window-item value="matrix">
        <v-card variant="outlined" class="pa-3" v-if="matrixRows.length">
          <v-table density="compact" class="border rounded">
            <thead>
              <tr>
                <th style="max-width:320px">Objective</th>
                <th v-for="m in matrixModuleIds" :key="m" class="pa-1">{{ moduleTitle(m) }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in matrixRows" :key="row.objectiveId">
                <th class="text-left">
                  <div class="text-body-2">{{ row.objectiveText }}</div>
                  <div class="text-caption text-medium-emphasis">{{ row.competencyTitle }}</div>
                </th>
                <td v-for="m in matrixModuleIds" :key="m" class="text-center">
                  <v-chip
                    v-if="row.cells[m]"
                    size="small" label :color="chipColor(row.cells[m].stage)"
                    :title="stageCellTitle(row.cells[m])"
                  >
                    {{ stageShort(row.cells[m].stage) }}
                  </v-chip>
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card>
        <v-alert v-else type="info" variant="tonal">Keine Objective-Mappings erfasst.</v-alert>
      </v-window-item>

      <v-window-item value="rubrics">
        <v-card v-for="r in rubrics" :key="r._id" variant="outlined" class="mb-3 pa-3">
          <div class="text-subtitle-1 font-weight-bold">{{ r.title }}</div>
          <v-table density="compact" class="mt-2">
            <thead><tr><th>Kriterium</th><th>Objective</th><th>Zielniveau</th></tr></thead>
            <tbody>
              <tr v-for="c in r.criteria" :key="c._id">
                <td>{{ c.name }}</td>
                <td>{{ objectiveText(c.objective_id ?? '') }}</td>
                <td>{{ c.target_level || '–' }}</td>
              </tr>
            </tbody>
          </v-table>
        </v-card>
        <v-card v-for="issue in rubricIssues" :key="issue.id" variant="tonal" color="warning" class="pa-3 mb-2">
          <b>{{ issue.competencyTitle }}</b>: Master-Level assessment in «{{ issue.moduleTitle }}» ohne Rubrik hinterlegt.
        </v-card>
      </v-window-item>

      <v-window-item value="aol">
        <v-card v-for="comp in aolRows" :key="comp.title" variant="outlined" class="pa-3 mb-3">
          <div class="text-subtitle-1 font-weight-bold">{{ comp.title }}</div>
          <div v-if="comp.points.length" class="mt-2">
            <div v-for="(pt, i) in comp.points" :key="i" class="text-body-2">
              <v-icon size="small" color="success" class="me-1">mdi-verified</v-icon>{{ pt }}
            </div>
          </div>
          <v-alert v-else type="warning" variant="tonal" dense class="mt-2">Kein AoL-Messpunkt vorhanden.</v-alert>
        </v-card>
      </v-window-item>

      <v-window-item value="loop">
        <v-card variant="outlined" class="pa-3">
          <div v-for="entry in loopItems" :key="entry._id" class="ma-2" v-html="'<b>' + entry.competencyTitle + '</b> → ' + entry.description + ' · ' + entry.formattedDate + ''" />
          <div v-if="loopItems.length === 0" class="text-caption text-medium-emphasis">
            Keine Loop-Eintragungen vorhanden.
          </div>
        </v-card>
      </v-window-item>
    </v-window>
</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { CompetencyFramework } from '@/types/competency'

const props = defineProps<{ initialTab?: 'matrix' | 'rubrics' | 'aol' | 'loop' }>()
const activeTab = ref<'matrix' | 'rubrics' | 'aol' | 'loop'>(props.initialTab ?? 'matrix')
watch(() => props.initialTab, (v) => { if (v) activeTab.value = v })

interface ObjectiveMapping {
  _id: string
  objective_id: string
  module_id: string
  stage: 'introduce' | 'reinforce' | 'master' | string
  learning_activity?: string
  assessment_ids?: string[]
}
interface MappingObjective { _id: string; text?: string; title?: string; competency_id?: string }
interface CompetencyItem { _id: string; title: string; frameworkId?: string; description?: string }
interface Rubric { _id: string; title: string; criteria: Array<{ _id: string; name: string; objective_id?: string; target_level?: string }> }
interface ImprovementAction { _id: string; competency_id?: string; description: string; date: string }
interface ProofStub { _id: string; title?: string; rubric_id?: string; is_aol_measurement_point?: boolean }

const frameworks = ref<Array<CompetencyFramework>>([])
const mappings = ref<ObjectiveMapping[]>([])
const objectives = ref<MappingObjective[]>([])
const competencies = ref<CompetencyItem[]>([])
const rubrics = ref<Rubric[]>([])
const proofs = ref<ProofStub[]>([])
const improvementActions = ref<ImprovementAction[]>([])
const modules = ref<Array<{ _id: string; title?: string; name?: string }>>([])



function moduleTitle(id: string): string {
  return modules.value.find(m => m._id === id)?.title ?? modules.value.find(m => m._id === id)?.name ?? id
}
function objectiveText(id: string): string {
  return objectives.value.find(o => o._id === id)?.text ?? objectives.value.find(o => o._id === id)?.title ?? id
}
function competencyTitleOf(id?: string): string {
  return competencies.value.find(c => c._id === id)?.title ?? ''
}
function findProof(pid: string): ProofStub | undefined {
  return proofs.value.find(p => p._id === pid)
}

function competencyKey(o?: MappingObjective): string {
  return (o?.competency_id ?? '') + (o?.text ?? o?.title ?? '')
}

interface MatrixRow {
  objectiveId: string
  objectiveText: string
  competencyTitle: string
  cells: Record<string, { stage: string; mapping: ObjectiveMapping }>
}

const matrixRows = computed<MatrixRow[]>(() => {
  const map = new Map<string, MatrixRow>()
  const relevant = mappings.value
  const sorted = [...relevant].sort((a, b) =>
    (competencyKey(objectives.value.find(o => o._id === a.objective_id)) + a.module_id)
      .localeCompare(competencyKey(objectives.value.find(o => o._id === b.objective_id)) + b.module_id))
  for (const mp of sorted) {
    let row = map.get(mp.objective_id)
    if (!row) {
      const o = objectives.value.find(x => x._id === mp.objective_id)
      row = {
        objectiveId: mp.objective_id,
        objectiveText: o?.text ?? o?.title ?? mp.objective_id,
        competencyTitle: competencyTitleOf(o?.competency_id),
        cells: {},
      }
      map.set(mp.objective_id, row)
    }
    row.cells[mp.module_id] = { stage: mp.stage, mapping: mp }
  }
  return [...map.values()]
})

const matrixModuleIds = computed<string[]>(() =>
  [...new Set(mappings.value.map(m => m.module_id))],
)

function chipColor(stage: string): string {
  switch (stage) {
    case 'introduce': return 'grey'
    case 'reinforce': return 'teal'
    case 'master': return 'deep-purple'
    default: return 'grey'
  }
}

function stageShort(stage: string): string {
  switch (stage) {
    case 'introduce': return 'I'
    case 'reinforce': return 'R'
    case 'master': return 'M'
    default: return '–'
  }
}

function stageCellTitle(cell: { mapping: ObjectiveMapping }): string {
  const proof = (cell.mapping.assessment_ids ?? []).map(findProof).find(Boolean)
  return `${cell.mapping.learning_activity ?? '–'} · Assessment: ${(proof as ProofStub | undefined)?.title ?? '–'}`
}

const rubricIssues = computed(() => {
  const issues: Array<{ id: string; competencyTitle: string; moduleTitle: string }> = []
  for (const mp of mappings.value) {
    if (mp.stage !== 'master') continue
        const proof = (mp.assessment_ids ?? []).map(findProof).find(Boolean)
    const obj = objectives.value.find(o => o._id === mp.objective_id)
    if (!proof || !proof.rubric_id) {
      issues.push({
        id: mp._id,
        competencyTitle: competencyTitleOf(obj?.competency_id),
        moduleTitle: moduleTitle(mp.module_id),
      })
    }
  }
  return issues
})

const aolRows = computed(() => {
  const rows: Array<{ title: string; points: string[] }> = []
  for (const comp of competencies.value) {
    const objIds = objectives.value.filter(o => o.competency_id === comp._id).map(o => o._id)
    const relMappings = mappings.value.filter(m => objIds.includes(m.objective_id))
    const points = relMappings
      .flatMap(mp => (mp.assessment_ids ?? []).map(findProof))
      .filter((p): p is ProofStub => !!p && !!p.is_aol_measurement_point)
    rows.push({ title: comp.title, points: points.map(p => p.title ?? p._id) })
  }
  return rows
})

const loopItems = computed(() =>
  improvementActions.value.map(ia => ({
    _id: ia._id,
    competencyTitle: competencyTitleOf(ia.competency_id),
    description: ia.description,
    formattedDate: ia.date,
  })),
)

onMounted(async () => {
  const fetchJson = async (table: string): Promise<unknown[]> => {
    const res = await fetch(`/api/${table}`)
    return res.ok ? (await res.json()) : []
  }
  const [fes, mps, objs, comps, rubl, proofList, actions, modList] = await Promise.all([
    fetchJson('competency_frameworks'),
    fetchJson('objective_mappings'),
    fetchJson('objectives'),
    fetchJson('competencies'),
    fetchJson('rubrics'),
    fetchJson('proof_of_knowledge'),
    fetchJson('improvement_actions'),
    fetchJson('modules'),
  ])
  frameworks.value = fes as Array<CompetencyFramework>
  mappings.value = mps as ObjectiveMapping[]
  objectives.value = objs as MappingObjective[]
  competencies.value = comps as CompetencyItem[]
  rubrics.value = rubl as Rubric[]
  proofs.value = proofList as ProofStub[]
  improvementActions.value = actions as ImprovementAction[]
  modules.value = modList as Array<{ _id: string; title?: string; name?: string }>
})
</script>
