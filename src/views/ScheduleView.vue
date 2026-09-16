<template>
  <v-container>
    <h1 class="mb-1">Schedule</h1>
    <p class="text-body-2 text-medium-emphasis mb-4">
      Define your availability and configure scheduling rules for the selected semester.
    </p>

    <v-row dense class="mb-4">
      <v-col cols="12" sm="6" md="4">
        <v-select
          v-model="selectedSemesterId"
          :items="semesterItems"
          item-title="title"
          item-value="value"
          label="Semester"
          prepend-inner-icon="mdi-school-outline"
          variant="outlined"
          density="compact"
          hide-details
          @update:model-value="handleSemesterChange"
        >
          <template #item="{ props: itemProps, item }">
            <v-list-item v-bind="itemProps">
              <v-list-item-subtitle>{{ (item as any).raw?.subtitle }}</v-list-item-subtitle>
            </v-list-item>
          </template>
        </v-select>
      </v-col>
    </v-row>

    <v-tabs v-model="activeTab">
      <v-tab value="availability">
        <v-icon start>mdi-calendar-clock</v-icon>
        Availability
      </v-tab>
      <v-tab value="rules">
        <v-icon start>mdi-tune-vertical</v-icon>
        Rules
      </v-tab>
    </v-tabs>

    <v-window v-model="activeTab" class="mt-4">
      <!-- Availability Tab -->
      <v-window-item value="availability">
        <v-alert v-if="!selectedSemesterId" type="info" variant="tonal" class="mb-4" density="compact">
          Select a semester above to manage your availability.
        </v-alert>

        <template v-else>
          <v-row class="align-center mb-4">
            <v-col cols="12" sm="6" class="d-flex ga-2">
              <v-btn color="primary" prepend-icon="mdi-plus" @click="openAddAvailability">
                Add Availability
              </v-btn>
              <v-btn variant="outlined" prepend-icon="mdi-file-import" @click="openCsvImport('availability')">
                Import CSV
              </v-btn>
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="availabilitySearch"
                prepend-inner-icon="mdi-magnify"
                label="Search availability"
                single-line
                hide-details
                clearable
                density="compact"
              />
            </v-col>
          </v-row>

          <v-data-table
            :headers="availabilityHeaders"
            :items="filteredAvailabilities"
            :sort-by="availabilitySortBy"
            @update:sort-by="availabilitySortBy = $event"
            hover
            items-per-page="15"
          >
            <template #item.recurringAvailability="{ item }">
              <div class="d-flex flex-wrap ga-1">
                <v-chip
                  v-for="slot in (item.recurringAvailability || []).slice(0, 5)"
                  :key="slot.id || slot.weekday + slot.startTime"
                  size="small"
                  variant="tonal"
                  color="primary"
                >
                  {{ formatWeekday(slot.weekday) }} {{ slot.startTime }}–{{ slot.endTime }}
                  <span v-if="slot.label" class="text-caption ms-1">({{ slot.label }})</span>
                </v-chip>
                <v-chip
                  v-if="(item.recurringAvailability || []).length > 5"
                  size="small"
                  variant="tonal"
                  color="default"
                >
                  +{{ item.recurringAvailability.length - 5 }} more
                </v-chip>
                <span v-if="!item.recurringAvailability?.length" class="text-medium-emphasis text-caption">No slots defined</span>
              </div>
            </template>
            <template #item.actions="{ item }">
              <v-btn icon variant="text" size="small" @click="openEditAvailability(item)">
                <v-icon>mdi-pencil</v-icon>
                <v-tooltip activator="parent">Edit</v-tooltip>
              </v-btn>
              <v-btn icon variant="text" size="small" @click="confirmDeleteAvailability(item)">
                <v-icon>mdi-delete</v-icon>
                <v-tooltip activator="parent">Delete</v-tooltip>
              </v-btn>
            </template>
            <template #no-data>
              <div class="text-center pa-4">
                <v-icon size="64" color="grey-lighten-1">mdi-calendar-clock</v-icon>
                <p class="mt-2 text-medium-emphasis">No availability entries for this semester.</p>
                <p class="text-caption text-medium-emphasis">Add your weekly availability for teaching.</p>
              </div>
            </template>
          </v-data-table>
        </template>
      </v-window-item>

      <!-- Rules Tab -->
      <v-window-item value="rules">
        <v-alert v-if="!selectedSemesterId" type="info" variant="tonal" class="mb-4" density="compact">
          Select a semester above to manage scheduling rules.
        </v-alert>

        <template v-else>
          <v-row class="align-center mb-4">
            <v-col cols="12" sm="6" class="d-flex ga-2">
              <v-btn v-if="auth.isAdmin" color="primary" prepend-icon="mdi-plus" @click="openAddRule">
                Add Rule
              </v-btn>
              <v-btn variant="outlined" prepend-icon="mdi-file-import" @click="openCsvImport('scheduling_rules')">
                Import CSV
              </v-btn>
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="ruleSearch"
                prepend-inner-icon="mdi-magnify"
                label="Search rules"
                single-line
                hide-details
                clearable
                density="compact"
              />
            </v-col>
          </v-row>

          <v-data-table
            :headers="ruleHeaders"
            :items="filteredRules"
            :sort-by="ruleSortBy"
            @update:sort-by="ruleSortBy = $event"
            hover
            items-per-page="15"
          >
            <template #item.constraintId="{ item }">
              <code class="text-body-2">{{ item.constraintId }}</code>
            </template>
            <template #item.category="{ item }">
              <v-chip
                size="small"
                :color="item.category === 'hard' ? 'error' : 'warning'"
                variant="tonal"
              >
                {{ item.category === 'hard' ? 'Hard' : 'Soft' }}
              </v-chip>
            </template>
            <template #item.enabled="{ item }">
              <v-icon :color="item.enabled ? 'success' : 'default'">
                {{ item.enabled ? 'mdi-check-circle' : 'mdi-close-circle' }}
              </v-icon>
            </template>
            <template #item.weight="{ item }">
              <span v-if="item.category === 'soft'" class="font-weight-medium">{{ item.weight }}</span>
              <span v-else class="text-medium-emphasis">—</span>
            </template>
            <template #item.appliesTo="{ item }">
              <div v-if="item.appliesTo?.length" class="d-flex flex-wrap ga-1">
                <v-chip
                  v-for="target in item.appliesTo.slice(0, 3)"
                  :key="target"
                  size="x-small"
                  variant="tonal"
                >
                  {{ target }}
                </v-chip>
                <v-chip v-if="item.appliesTo.length > 3" size="x-small" variant="tonal" color="default">
                  +{{ item.appliesTo.length - 3 }}
                </v-chip>
              </div>
              <span v-else class="text-medium-emphasis text-caption">All</span>
            </template>
            <template #item.actions="{ item }">
              <v-btn v-if="auth.isAdmin" icon variant="text" size="small" @click="openEditRule(item)">
                <v-icon>mdi-pencil</v-icon>
                <v-tooltip activator="parent">Edit</v-tooltip>
              </v-btn>
              <v-btn v-if="auth.isAdmin" icon variant="text" size="small" @click="confirmDeleteRule(item)">
                <v-icon>mdi-delete</v-icon>
                <v-tooltip activator="parent">Delete</v-tooltip>
              </v-btn>
              <span v-if="!auth.isAdmin" class="text-medium-emphasis text-caption">Read-only</span>
            </template>
            <template #no-data>
              <div class="text-center pa-4">
                <v-icon size="64" color="grey-lighten-1">mdi-tune-vertical</v-icon>
                <p class="mt-2 text-medium-emphasis">No scheduling rules for this semester.</p>
                <p class="text-caption text-medium-emphasis">Add rules to control how CP-SAT builds the timetable.</p>
              </div>
            </template>
          </v-data-table>
        </template>
      </v-window-item>
    </v-window>

    <!-- Availability Form Dialog -->
    <AvailabilityFormDialog
      v-model="availabilityDialogOpen"
      :availability-data="editingAvailability"
      :current-user-id="currentUserId"
      :current-semester-id="selectedSemesterId"
      @save="handleSaveAvailability"
    />

    <!-- Scheduling Rule Form Dialog -->
    <SchedulingRuleFormDialog
      v-model="ruleDialogOpen"
      :rule-data="editingRule"
      :current-semester-id="selectedSemesterId"
      @save="handleSaveRule"
    />

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="deleteDialogOpen" max-width="420">
      <v-card>
        <v-card-title class="text-h6">Confirm Deletion</v-card-title>
        <v-card-text>
          Are you sure you want to delete <strong>{{ deleteTargetName }}</strong>?
          This action cannot be undone.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteDialogOpen = false">Cancel</v-btn>
          <v-btn color="error" variant="flat" @click="executeDelete">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- CSV Import Dialog -->
    <CsvImportDialog
      v-model="csvImportDialogOpen"
      :initial-type="csvImportType"
      :allowed-types="['availability', 'scheduling_rules']"
      @imported="handleCsvImported"
    />
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useCurriculumStore } from '@/stores/curriculum'
import { useAuthStore } from '@/stores/auth'
import { useAvailability } from '@/composables/useAvailability'
import { useSchedulingRules } from '@/composables/useSchedulingRules'
import type { LecturerAvailability, SchedulingRule, Weekday } from '@/types/schedule'
import { WEEKDAY_LABELS } from '@/types/schedule'
import AvailabilityFormDialog from '@/components/AvailabilityFormDialog.vue'
import SchedulingRuleFormDialog from '@/components/SchedulingRuleFormDialog.vue'
import CsvImportDialog from '@/components/CsvImportDialog.vue'

const store = useCurriculumStore()
const auth = useAuthStore()
const { semesters } = storeToRefs(store)
const { availabilities, fetchAvailabilities, addAvailability, updateAvailability, removeAvailability } = useAvailability()
const { rules, fetchRules, addRule, updateRule, removeRule } = useSchedulingRules()

const currentUserId = computed(() => auth.localUser?.id || auth.localUser?.oidc_subject || '')

const selectedSemesterId = ref('')
const activeTab = ref<'availability' | 'rules'>('availability')
const availabilitySearch = ref('')
const ruleSearch = ref('')
const availabilitySortBy = ref<{ key: string; order: 'asc' | 'desc' }[]>([{ key: 'lecturerId', order: 'asc' }])
const ruleSortBy = ref<{ key: string; order: 'asc' | 'desc' }[]>([{ key: 'constraintId', order: 'asc' }])

const semesterItems = computed(() => {
  const items = semesters.value.map(s => ({
    title: s.identifier,
    value: s._id || s.id || '',
    subtitle: `${s.startDate} – ${s.endDate}`,
  }))
  if (items.length === 0) {
    return [{ title: 'No semesters defined', value: '', subtitle: 'Create a semester first' }]
  }
  return [{ title: 'Select a semester', value: '', subtitle: 'Choose which semester to manage' }, ...items]
})

const semesterAvailabilities = computed(() => {
  if (!selectedSemesterId.value) return []
  return availabilities.value.filter(a => a.semesterId === selectedSemesterId.value)
})

const semesterRules = computed(() => {
  if (!selectedSemesterId.value) return []
  return rules.value.filter(r => r.semesterId === selectedSemesterId.value)
})

const availabilityHeaders = [
  { title: 'Weekly Availability', key: 'recurringAvailability', sortable: false },
  { title: 'Actions', key: 'actions', sortable: false, align: 'end' as const },
]

const ruleHeaders = [
  { title: 'Rule ID', key: 'constraintId', sortable: true },
  { title: 'Category', key: 'category', sortable: true },
  { title: 'Enabled', key: 'enabled', sortable: true },
  { title: 'Weight', key: 'weight', sortable: true },
  { title: 'Description', key: 'description', sortable: true },
  { title: 'Applies To', key: 'appliesTo', sortable: false },
  { title: 'Actions', key: 'actions', sortable: false, align: 'end' as const },
]

const filteredAvailabilities = computed(() => {
  const q = availabilitySearch.value?.toLowerCase() || ''
  if (!q) return semesterAvailabilities.value
  return semesterAvailabilities.value.filter(a => {
    const slots = (a.recurringAvailability || []).map(s => WEEKDAY_LABELS[s.weekday as Weekday]?.toLowerCase() || '').join(' ')
    const labels = (a.recurringAvailability || []).map(s => (s.label || '').toLowerCase()).join(' ')
    return slots.includes(q) || labels.includes(q)
  })
})

const filteredRules = computed(() => {
  const q = ruleSearch.value?.toLowerCase() || ''
  if (!q) return semesterRules.value
  return semesterRules.value.filter(r =>
    r.constraintId.toLowerCase().includes(q) ||
    (r.description || '').toLowerCase().includes(q) ||
    r.category.includes(q) ||
    (r.appliesTo || []).some(t => t.toLowerCase().includes(q))
  )
})

function formatWeekday(wd: Weekday): string {
  return WEEKDAY_LABELS[wd] || wd
}

function handleSemesterChange() {
  availabilitySearch.value = ''
  ruleSearch.value = ''
}

// Availability dialog
const availabilityDialogOpen = ref(false)
const editingAvailability = ref<LecturerAvailability | null>(null)

function openAddAvailability() {
  editingAvailability.value = null
  availabilityDialogOpen.value = true
}

function openEditAvailability(item: LecturerAvailability) {
  editingAvailability.value = JSON.parse(JSON.stringify(item))
  availabilityDialogOpen.value = true
}

async function handleSaveAvailability(avail: LecturerAvailability) {
  if (avail._id || avail.id) {
    await updateAvailability(avail)
  } else {
    await addAvailability(avail)
  }
}

// Rule dialog
const ruleDialogOpen = ref(false)
const editingRule = ref<SchedulingRule | null>(null)

function openAddRule() {
  editingRule.value = null
  ruleDialogOpen.value = true
}

function openEditRule(item: SchedulingRule) {
  editingRule.value = JSON.parse(JSON.stringify(item))
  ruleDialogOpen.value = true
}

async function handleSaveRule(rule: SchedulingRule) {
  if (rule._id || rule.id) {
    await updateRule(rule)
  } else {
    await addRule(rule)
  }
}

// Delete dialog
const deleteDialogOpen = ref(false)
const deleteTargetName = ref('')
type DeleteTarget = { type: 'availability'; id: string } | { type: 'rule'; id: string }
let deleteTarget: DeleteTarget | null = null

function confirmDeleteAvailability(item: LecturerAvailability) {
  deleteTarget = { type: 'availability', id: item._id || item.id || '' }
  deleteTargetName.value = 'this availability entry'
  deleteDialogOpen.value = true
}

function confirmDeleteRule(item: SchedulingRule) {
  deleteTarget = { type: 'rule', id: item._id || item.id || '' }
  deleteTargetName.value = item.constraintId
  deleteDialogOpen.value = true
}

async function executeDelete() {
  if (!deleteTarget) return
  if (deleteTarget.type === 'availability') {
    await removeAvailability(deleteTarget.id)
  } else {
    await removeRule(deleteTarget.id)
  }
  deleteTarget = null
  deleteDialogOpen.value = false
}

// CSV Import
const csvImportDialogOpen = ref(false)
const csvImportType = ref<'availability' | 'scheduling_rules'>('availability')

function openCsvImport(type: 'availability' | 'scheduling_rules') {
  csvImportType.value = type
  csvImportDialogOpen.value = true
}

async function handleCsvImported() {
  if (csvImportType.value === 'availability') {
    await fetchAvailabilities()
  } else {
    await fetchRules()
  }
}

onMounted(() => {
  store.fetchSemesters()
  fetchAvailabilities()
  fetchRules()
})
</script>