<template>
  <v-container>
    <h1 class="mb-1">Taxonomy</h1>
    <p class="text-body-2 text-medium-emphasis mb-4">
      Manage competency frameworks, learning objectives, and proofs of knowledge used across the curriculum.
    </p>

    <v-tabs v-model="activeTab">
      <v-tab value="competencies">Competencies</v-tab>
      <v-tab value="proofs_of_knowledge">Proofs of Knowledge</v-tab>
    </v-tabs>

    <v-window v-model="activeTab" class="mt-4">
      <v-window-item value="competencies">
        <v-row class="align-center mb-4">
          <v-col cols="12" sm="6" class="d-flex ga-2">
            <v-btn color="primary" prepend-icon="mdi-plus" @click="openAddCompetency">Add Competency</v-btn>
            <v-btn variant="outlined" prepend-icon="mdi-file-import" @click="openCsvImport('competencies')">Import CSV</v-btn>
          </v-col>
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="competencySearch"
              prepend-inner-icon="mdi-magnify"
              label="Search competencies"
              single-line
              hide-details
              clearable
              density="compact"
            />
          </v-col>
        </v-row>

        <v-data-table
          :headers="competencyHeaders"
          :items="filteredCompetencies"
          :sort-by="competencySortBy"
          @update:sort-by="competencySortBy = $event"
          hover
          items-per-page="15"
        >
          <template #item.category="{ item }">
            {{ item.category || '-' }}
          </template>
          <template #item.level="{ item }">
            <v-chip v-if="item.level" size="small" :color="getLevelColor(item.level)">
              {{ formatLevel(item.level) }}
            </v-chip>
            <span v-else class="text-medium-emphasis">-</span>
          </template>
          <template #item.description="{ item }">
            {{ item.description || '-' }}
          </template>
          <template #item.actions="{ item }">
            <v-btn icon variant="text" size="small" @click="openEditCompetency(item)">
              <v-icon>mdi-pencil</v-icon>
              <v-tooltip activator="parent">Edit</v-tooltip>
            </v-btn>
            <v-btn icon variant="text" size="small" @click="confirmDeleteCompetency(item)">
              <v-icon>mdi-delete</v-icon>
              <v-tooltip activator="parent">Delete</v-tooltip>
            </v-btn>
          </template>
          <template #no-data>
            <div class="text-center pa-4">
              <v-icon size="64" color="grey-lighten-1">mdi-school</v-icon>
              <p class="mt-2 text-medium-emphasis">No competencies found.</p>
            </div>
          </template>
        </v-data-table>
      </v-window-item>

      <v-window-item value="proofs_of_knowledge">
        <v-row class="align-center mb-4">
          <v-col cols="12" sm="6" class="d-flex ga-2">
            <v-btn color="primary" prepend-icon="mdi-plus" @click="openAddProofOfKnowledge">Add Proof of Knowledge</v-btn>
            <v-btn variant="outlined" prepend-icon="mdi-file-import" @click="openCsvImport('proofs_of_knowledge')">Import CSV</v-btn>
          </v-col>
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="proofSearch"
              prepend-inner-icon="mdi-magnify"
              label="Search proofs of knowledge"
              single-line
              hide-details
              clearable
              density="compact"
            />
          </v-col>
        </v-row>

        <v-data-table
          :headers="proofHeaders"
          :items="filteredProofsOfKnowledge"
          :sort-by="proofSortBy"
          @update:sort-by="proofSortBy = $event"
          hover
          items-per-page="15"
        >
          <template #item.assessmentType="{ item }">
            <v-chip
              v-if="item.assessmentType"
              size="small"
              :color="item.assessmentType === 'written' ? 'primary' : 'secondary'"
              variant="tonal"
            >
              {{ item.assessmentType === 'written' ? 'Written' : item.assessmentType === 'oral' ? 'Oral' : item.assessmentType }}
            </v-chip>
            <span v-else class="text-medium-emphasis">-</span>
          </template>
          <template #item.multipleChoice="{ item }">
            <v-chip v-if="item.multipleChoice" size="x-small" color="success" variant="tonal">Yes</v-chip>
            <span v-else class="text-medium-emphasis text-caption">No</span>
          </template>
          <template #item.freeText="{ item }">
            <v-chip v-if="item.freeText" size="x-small" color="info" variant="tonal">Yes</v-chip>
            <span v-else class="text-medium-emphasis text-caption">No</span>
          </template>
          <template #item.assignmentScope="{ item }">
            <v-chip
              v-if="item.assignmentScope"
              size="small"
              :color="item.assignmentScope === 'group' ? 'deep-purple' : 'teal'"
              variant="tonal"
            >
              {{ item.assignmentScope === 'group' ? 'Group' : 'Individual' }}
            </v-chip>
            <span v-else class="text-medium-emphasis">-</span>
          </template>
          <template #item.durationMinutes="{ item }">
            <span v-if="item.durationMinutes !== undefined && item.durationMinutes !== null">
              {{ item.durationMinutes }} min
            </span>
            <span v-else class="text-medium-emphasis">-</span>
          </template>
          <template #item.description="{ item }">
            {{ item.description || '-' }}
          </template>
          <template #item.actions="{ item }">
            <v-btn icon variant="text" size="small" @click="openEditProofOfKnowledge(item)">
              <v-icon>mdi-pencil</v-icon>
              <v-tooltip activator="parent">Edit</v-tooltip>
            </v-btn>
            <v-btn icon variant="text" size="small" @click="confirmDeleteProofOfKnowledge(item)">
              <v-icon>mdi-delete</v-icon>
              <v-tooltip activator="parent">Delete</v-tooltip>
            </v-btn>
          </template>
          <template #no-data>
            <div class="text-center pa-4">
              <v-icon size="64" color="grey-lighten-1">mdi-file-certificate-outline</v-icon>
              <p class="mt-2 text-medium-emphasis">No proofs of knowledge found.</p>
            </div>
          </template>
        </v-data-table>
      </v-window-item>
    </v-window>

    <CompetencyFormDialog
      v-model="competencyDialogOpen"
      :competency-data="editCompetency"
      @save="handleCompetencySave"
    />

    <ProofOfKnowledgeFormDialog
      v-model="proofDialogOpen"
      :proof-data="editProof"
      @save="handleProofSave"
    />

    <CsvImportDialog
      v-model="csvImportDialogOpen"
      :initial-type="currentCsvImportType"
      @imported="handleCsvImported"
    />

    <v-dialog v-model="deleteDialogOpen" max-width="420">
      <v-card>
        <v-card-title>Confirm deletion</v-card-title>
        <v-card-text>
          Are you sure you want to delete <strong>{{ deleteTargetName }}</strong>?
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteDialogOpen = false">Cancel</v-btn>
          <v-btn color="error" variant="flat" @click="handleDelete">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar" :color="snackbarColor" :timeout="3000">
      {{ snackbarText }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useCompetencies } from '@/composables/useCompetencies'
import { useProofsOfKnowledge } from '@/composables/useProofsOfKnowledge'
import CompetencyFormDialog from '@/components/CompetencyFormDialog.vue'
import ProofOfKnowledgeFormDialog from '@/components/ProofOfKnowledgeFormDialog.vue'
import CsvImportDialog from '@/components/CsvImportDialog.vue'
import type { Competency } from '@/types/competency'
import type { ProofOfKnowledge } from '@/types/proofOfKnowledge'
import type { ImportType } from '@/types/csvImport'

const {
  competencies,
  fetchCompetencies,
  addCompetency,
  updateCompetency,
  removeCompetency,
} = useCompetencies()

const {
  proofsOfKnowledge,
  fetchProofsOfKnowledge,
  addProofOfKnowledge,
  updateProofOfKnowledge,
  removeProofOfKnowledge,
} = useProofsOfKnowledge()

const activeTab = ref<'competencies' | 'proofs_of_knowledge'>('competencies')

// Competencies tab state
const competencySearch = ref('')
const competencyDialogOpen = ref(false)
const editCompetency = ref<Competency | undefined>(undefined)
const competencySortBy = ref<{ key: string; order: 'asc' | 'desc' }[]>([])

// Proofs of Knowledge tab state
const proofSearch = ref('')
const proofDialogOpen = ref(false)
const editProof = ref<ProofOfKnowledge | undefined>(undefined)
const proofSortBy = ref<{ key: string; order: 'asc' | 'desc' }[]>([])

// CSV Import state
const csvImportDialogOpen = ref(false)
const currentCsvImportType = ref<ImportType>('competencies')

// Delete dialog state
const deleteDialogOpen = ref(false)
const deleteTargetName = ref('')
let deleteTargetType: 'competency' | 'proof_of_knowledge' = 'competency'
let deleteId = ''

// Snackbar state
const snackbar = ref(false)
const snackbarText = ref('')
const snackbarColor = ref('success')

const competencyHeaders = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Category', key: 'category', sortable: true },
  { title: 'Level', key: 'level', sortable: true },
  { title: 'Description', key: 'description', sortable: true },
  { title: '', key: 'actions', sortable: false, width: '100px' },
]

const proofHeaders = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Format', key: 'assessmentType', sortable: true, width: '120px' },
  { title: 'Multiple Choice', key: 'multipleChoice', sortable: true, width: '130px' },
  { title: 'Free Text', key: 'freeText', sortable: true, width: '120px' },
  { title: 'Assignment', key: 'assignmentScope', sortable: true, width: '130px' },
  { title: 'Duration', key: 'durationMinutes', sortable: true, width: '110px' },
  { title: 'Description', key: 'description', sortable: true },
  { title: '', key: 'actions', sortable: false, width: '100px' },
]

function formatLevel(level?: string): string {
  if (!level) return '-'
  if (level === 'I' || level === 'Introduction') return 'Introduction (I)'
  if (level === 'R' || level === 'Regular') return 'Regular (R)'
  if (level === 'M' || level === 'Master') return 'Master (M)'
  return level
}

function getLevelColor(level?: string): string {
  if (!level) return 'default'
  const l = level.toLowerCase()
  if (l === 'i' || l.startsWith('intro')) return 'info'
  if (l === 'r' || l.startsWith('regul')) return 'success'
  if (l === 'm' || l.startsWith('mast')) return 'warning'
  return 'default'
}

const filteredCompetencies = computed(() => {
  if (!competencySearch.value) return competencies.value
  const q = competencySearch.value.toLowerCase()
  return competencies.value.filter(c =>
    c.name.toLowerCase().includes(q) ||
    (c.category ?? '').toLowerCase().includes(q) ||
    (c.description ?? '').toLowerCase().includes(q) ||
    (c.level ?? '').toLowerCase().includes(q)
  )
})

const filteredProofsOfKnowledge = computed(() => {
  if (!proofSearch.value) return proofsOfKnowledge.value
  const q = proofSearch.value.toLowerCase()
  return proofsOfKnowledge.value.filter(p =>
    p.name.toLowerCase().includes(q) ||
    (p.description ?? '').toLowerCase().includes(q) ||
    (p.assessmentType ?? '').toLowerCase().includes(q) ||
    (p.assignmentScope ?? '').toLowerCase().includes(q)
  )
})

function openAddCompetency() {
  editCompetency.value = undefined
  competencyDialogOpen.value = true
}

function openEditCompetency(comp: Competency) {
  editCompetency.value = comp
  competencyDialogOpen.value = true
}

async function handleCompetencySave(comp: Competency) {
  try {
    if (comp.id) {
      await updateCompetency(comp)
      showSnackbar('Competency updated')
    } else {
      await addCompetency(comp)
      showSnackbar('Competency added')
    }
  } catch {
    showSnackbar('Operation failed', 'error')
  }
}

function confirmDeleteCompetency(comp: Competency) {
  deleteTargetType = 'competency'
  deleteId = comp.id ?? ''
  deleteTargetName.value = comp.name
  deleteDialogOpen.value = true
}

function openAddProofOfKnowledge() {
  editProof.value = undefined
  proofDialogOpen.value = true
}

function openEditProofOfKnowledge(proof: ProofOfKnowledge) {
  editProof.value = proof
  proofDialogOpen.value = true
}

async function handleProofSave(proof: ProofOfKnowledge) {
  try {
    if (proof.id) {
      await updateProofOfKnowledge(proof)
      showSnackbar('Proof of knowledge updated')
    } else {
      await addProofOfKnowledge(proof)
      showSnackbar('Proof of knowledge added')
    }
  } catch {
    showSnackbar('Operation failed', 'error')
  }
}

function confirmDeleteProofOfKnowledge(proof: ProofOfKnowledge) {
  deleteTargetType = 'proof_of_knowledge'
  deleteId = proof.id ?? ''
  deleteTargetName.value = proof.name
  deleteDialogOpen.value = true
}

async function handleDelete() {
  try {
    if (deleteTargetType === 'competency') {
      await removeCompetency(deleteId)
      showSnackbar('Competency deleted')
    } else {
      await removeProofOfKnowledge(deleteId)
      showSnackbar('Proof of knowledge deleted')
    }
  } catch {
    showSnackbar('Deletion failed', 'error')
  }
  deleteDialogOpen.value = false
}

function openCsvImport(type: ImportType) {
  currentCsvImportType.value = type
  csvImportDialogOpen.value = true
}

async function handleCsvImported(payload: { type: ImportType; count: number; items: any[] }) {
  if (payload.type === 'competencies') {
    await fetchCompetencies()
    showSnackbar(`${payload.count} competency${payload.count === 1 ? '' : 'ies'} imported successfully`)
  } else if (payload.type === 'proofs_of_knowledge') {
    await fetchProofsOfKnowledge()
    showSnackbar(`${payload.count} proof${payload.count === 1 ? '' : 's'} of knowledge imported successfully`)
  }
}

function showSnackbar(text: string, color: string = 'success') {
  snackbarText.value = text
  snackbarColor.value = color
  snackbar.value = true
}

onMounted(async () => {
  await Promise.all([
    fetchCompetencies(),
    fetchProofsOfKnowledge(),
  ])
})
</script>
