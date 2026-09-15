<template>
  <v-container>
    <h1 class="mb-1">Taxonomy</h1>
    <p class="text-body-2 text-medium-emphasis mb-4">
      Manage competency frameworks, learning objectives, and proofs of knowledge used across the curriculum.
    </p>

    <v-tabs v-model="activeTab">
      <v-tab value="competencies">Competencies</v-tab>
    </v-tabs>

    <v-window v-model="activeTab" class="mt-4">
      <v-window-item value="competencies">
        <v-row class="align-center mb-4">
          <v-col cols="12" sm="6" class="d-flex ga-2">
            <v-btn color="primary" prepend-icon="mdi-plus" @click="openAddCompetency">Add Competency</v-btn>
            <v-btn variant="outlined" prepend-icon="mdi-file-import" @click="csvImportDialogOpen = true">Import CSV</v-btn>
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
    </v-window>

    <CompetencyFormDialog
      v-model="competencyDialogOpen"
      :competency-data="editCompetency"
      @save="handleCompetencySave"
    />

    <CsvImportDialog
      v-model="csvImportDialogOpen"
      initial-type="competencies"
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
import CompetencyFormDialog from '@/components/CompetencyFormDialog.vue'
import CsvImportDialog from '@/components/CsvImportDialog.vue'
import type { Competency } from '@/types/competency'
import type { ImportType } from '@/types/csvImport'

const {
  competencies,
  fetchCompetencies,
  addCompetency,
  updateCompetency,
  removeCompetency,
} = useCompetencies()

const activeTab = ref('competencies')

const competencySearch = ref('')
const competencyDialogOpen = ref(false)
const editCompetency = ref<Competency | undefined>(undefined)
const competencySortBy = ref<{ key: string; order: 'asc' | 'desc' }[]>([])
const csvImportDialogOpen = ref(false)

const deleteDialogOpen = ref(false)
const deleteTargetName = ref('')
let deleteId = ''

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
  deleteId = comp.id ?? ''
  deleteTargetName.value = comp.name
  deleteDialogOpen.value = true
}

async function handleDelete() {
  try {
    await removeCompetency(deleteId)
    showSnackbar('Competency deleted')
  } catch {
    showSnackbar('Deletion failed', 'error')
  }
  deleteDialogOpen.value = false
}

async function handleCsvImported(payload: { type: ImportType; count: number; items: any[] }) {
  await fetchCompetencies()
  showSnackbar(`${payload.count} competency${payload.count === 1 ? '' : 'ies'} imported successfully`)
}

function showSnackbar(text: string, color: string = 'success') {
  snackbarText.value = text
  snackbarColor.value = color
  snackbar.value = true
}

onMounted(() => {
  fetchCompetencies()
})
</script>
