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
      <v-tab value="weeks">
        <v-icon start>mdi-calendar-week</v-icon>
        Weeks
      </v-tab>
      <v-tab value="entries">
        <v-icon start>mdi-calendar-clock-outline</v-icon>
        Schedule Entries
      </v-tab>
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
            <template #item.weekday="{ item }">
              {{ formatWeekday(item.weekday) }}
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

      <!-- Weeks Tab -->
      <v-window-item value="weeks">
        <v-alert v-if="!selectedSemesterId" type="info" variant="tonal" class="mb-4" density="compact">
          Select a semester above to manage its calendar weeks.
        </v-alert>

        <template v-else>
          <v-row class="align-center mb-4">
            <v-col cols="12" sm="6" class="d-flex ga-2">
              <v-btn color="primary" prepend-icon="mdi-plus" @click="openAddWeek">
                Add Week
              </v-btn>
              <v-btn variant="outlined" prepend-icon="mdi-file-import" @click="openCsvImport('weeks')">
                Import CSV
              </v-btn>
            </v-col>
          </v-row>

          <v-data-table
            :headers="weekHeaders"
            :items="semesterWeeks"
            :sort-by="weekSortBy"
            @update:sort-by="weekSortBy = $event"
            hover
            items-per-page="15"
          >
            <template #item.semesterWeek="{ item }">
              <span class="font-weight-medium">{{ item.semesterWeek }}</span>
            </template>
            <template #item.daysOff="{ item }">
              <div v-if="item.daysOff?.length" class="d-flex flex-wrap ga-1">
                <v-chip v-for="day in item.daysOff" :key="day" size="x-small" variant="tonal" color="warning">
                  {{ day }}
                </v-chip>
              </div>
              <span v-else class="text-medium-emphasis text-caption">—</span>
            </template>
            <template #item.actions="{ item }">
              <v-btn icon variant="text" size="small" @click="openEditWeek(item)">
                <v-icon>mdi-pencil</v-icon>
                <v-tooltip activator="parent">Edit</v-tooltip>
              </v-btn>
              <v-btn icon variant="text" size="small" @click="confirmDeleteWeek(item)">
                <v-icon>mdi-delete</v-icon>
                <v-tooltip activator="parent">Delete</v-tooltip>
              </v-btn>
            </template>
          </v-data-table>
        </template>
      </v-window-item>

      <!-- Schedule Entries Tab -->
      <v-window-item value="entries">
        <v-alert v-if="!selectedSemesterId" type="info" variant="tonal" class="mb-4" density="compact">
          Select a semester above to manage schedule entries.
        </v-alert>

        <template v-else>
          <v-row class="align-center mb-4">
            <v-col cols="12" sm="6" class="d-flex ga-2">
              <v-btn color="primary" prepend-icon="mdi-plus" @click="openAddEntry">
                Add Entry
              </v-btn>
              <v-btn variant="outlined" prepend-icon="mdi-file-import" @click="openCsvImport('schedule_entries')">
                Import CSV
              </v-btn>
            </v-col>
          </v-row>

          <v-data-table
            :headers="entryHeaders"
            :items="semesterEntries"
            :sort-by="entrySortBy"
            @update:sort-by="entrySortBy = $event"
            hover
            items-per-page="15"
          >
            <template #item.weekId="{ item }">
              {{ formatWeek(item.weekId) }}
            </template>
            <template #item.moduleIds="{ item }">
              <div v-if="item.moduleIds?.length" class="d-flex flex-wrap ga-1">
                <v-chip v-for="id in item.moduleIds" :key="id" size="x-small" variant="tonal">
                  {{ getModuleName(id) }}
                </v-chip>
              </div>
              <span v-else class="text-medium-emphasis text-caption">Unassigned</span>
            </template>
            <template #item.roomIds="{ item }">
              <div v-if="item.roomIds?.length" class="d-flex flex-wrap ga-1">
                <v-chip v-for="id in item.roomIds" :key="id" size="x-small" variant="tonal" color="teal">
                  {{ getRoomName(id) }}
                </v-chip>
              </div>
              <span v-else class="text-medium-emphasis text-caption">Unassigned</span>
            </template>
            <template #item.classIds="{ item }">
              <div v-if="item.classIds?.length" class="d-flex flex-wrap ga-1">
                <v-chip v-for="id in item.classIds" :key="id" size="x-small" variant="tonal" color="secondary">
                  {{ getClassName(id) }}
                </v-chip>
              </div>
              <span v-else class="text-medium-emphasis text-caption">Unassigned</span>
            </template>
            <template #item.lecturerIds="{ item }">
              <div v-if="item.lecturerIds?.length" class="d-flex flex-wrap ga-1">
                <v-chip v-for="id in item.lecturerIds" :key="id" size="x-small" variant="tonal" color="indigo">
                  {{ getLecturerName(id) }}
                </v-chip>
              </div>
              <span v-else class="text-medium-emphasis text-caption">Unassigned</span>
            </template>
            <template #item.weekday="{ item }">
              {{ formatWeekday(item.weekday as Weekday) }}
            </template>
            <template #item.actions="{ item }">
              <v-btn icon variant="text" size="small" @click="openEditEntry(item)">
                <v-icon>mdi-pencil</v-icon>
                <v-tooltip activator="parent">Edit</v-tooltip>
              </v-btn>
              <v-btn icon variant="text" size="small" @click="confirmDeleteEntry(item)">
                <v-icon>mdi-delete</v-icon>
                <v-tooltip activator="parent">Delete</v-tooltip>
              </v-btn>
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
            <template #item.ruleType="{ item }">
              <code class="text-body-2">{{ item.ruleType }}</code>
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
              <span v-if="item.category === 'soft'" class="font-weight-medium">
                <v-chip size="small" :color="getWeightColor(item.weight)" variant="tonal">
                  {{ getWeightLabel(item.weight) }}
                </v-chip>
              </span>
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
      :weeks="weeks"
      @save="handleSaveAvailability"
    />

    <!-- Week Form Dialog -->
    <WeekFormDialog
      v-model="weekDialogOpen"
      :week-data="editingWeek"
      :semesters="semesters"
      @save="handleSaveWeek"
    />

    <!-- Schedule Entry Form Dialog -->
    <ScheduleEntryFormDialog
      v-model="entryDialogOpen"
      :entry-data="editingEntry"
      :weeks="semesterWeeks"
      :modules="modules"
      :rooms="rooms"
      :classes="classes"
      :lecturers="lecturers"
      @save="handleSaveEntry"
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
import { useWeeks } from '@/composables/useWeeks'
import { useScheduleEntries } from '@/composables/useScheduleEntries'
import { useClasses } from '@/composables/useClasses'
import type { LecturerAvailability, SchedulingRule, Weekday } from '@/types/schedule'
import type { Week } from '@/types/week'
import type { ScheduleEntry } from '@/types/scheduleEntry'
import { WEEKDAY_LABELS } from '@/types/schedule'
import AvailabilityFormDialog from '@/components/AvailabilityFormDialog.vue'
import SchedulingRuleFormDialog from '@/components/SchedulingRuleFormDialog.vue'
import WeekFormDialog from '@/components/WeekFormDialog.vue'
import ScheduleEntryFormDialog from '@/components/ScheduleEntryFormDialog.vue'
import CsvImportDialog from '@/components/CsvImportDialog.vue'

const store = useCurriculumStore()
const auth = useAuthStore()
const { semesters, modules, rooms, lecturers } = storeToRefs(store)
const { classes, fetchClasses } = useClasses()
const { availabilities, fetchAvailabilities, addAvailability, updateAvailability, removeAvailability } = useAvailability()
const { rules, fetchRules, addRule, updateRule, removeRule } = useSchedulingRules()
const { weeks, fetchWeeks, addWeek, updateWeek, removeWeek } = useWeeks()
const { scheduleEntries, fetchScheduleEntries, addScheduleEntry, updateScheduleEntry, removeScheduleEntry } = useScheduleEntries()

const currentUserId = computed(() => auth.localUser?.id || auth.localUser?.oidc_subject || '')

const selectedSemesterId = ref('')
const activeTab = ref<'weeks' | 'entries' | 'availability' | 'rules'>('availability')
const availabilitySearch = ref('')
const ruleSearch = ref('')
const availabilitySortBy = ref<{ key: string; order: 'asc' | 'desc' }[]>([{ key: 'lecturerId', order: 'asc' }])
const ruleSortBy = ref<{ key: string; order: 'asc' | 'desc' }[]>([{ key: 'ruleType', order: 'asc' }])
const weekSortBy = ref<{ key: string; order: 'asc' | 'desc' }[]>([{ key: 'semesterWeek', order: 'asc' }])
const entrySortBy = ref<{ key: string; order: 'asc' | 'desc' }[]>([{ key: 'weekday', order: 'asc' }])

const semesterItems = computed(() => {
  const items = semesters.value.map(s => ({
    title: s.name || s.code,
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
  return availabilities.value.filter(a => a.lecturerId)
})

const semesterRules = computed(() => {
  if (!selectedSemesterId.value) return []
  return rules.value.filter(r => r.semesterId === selectedSemesterId.value)
})

const semesterWeeks = computed(() => {
  if (!selectedSemesterId.value) return []
  return weeks.value
    .filter(w => w.semesterId === selectedSemesterId.value)
    .sort((a, b) => a.semesterWeek - b.semesterWeek)
})

const semesterEntries = computed(() => {
  if (!selectedSemesterId.value) return []
  const weekIds = new Set(weeks.value.filter(w => w.semesterId === selectedSemesterId.value).map(w => w.id || w._id))
  return scheduleEntries.value.filter(e => weekIds.has(e.weekId))
})

const weekHeaders = [
  { title: 'Week', key: 'semesterWeek', sortable: true },
  { title: 'Start', key: 'startDate', sortable: true },
  { title: 'End', key: 'endDate', sortable: true },
  { title: 'Days Off', key: 'daysOff', sortable: false },
  { title: 'Actions', key: 'actions', sortable: false, align: 'end' as const },
]

const entryHeaders = [
  { title: 'Week', key: 'weekId', sortable: true },
  { title: 'Day', key: 'weekday', sortable: true },
  { title: 'Start', key: 'startTime', sortable: true },
  { title: 'End', key: 'endTime', sortable: true },
  { title: 'Modules', key: 'moduleIds', sortable: false },
  { title: 'Rooms', key: 'roomIds', sortable: false },
  { title: 'Classes', key: 'classIds', sortable: false },
  { title: 'Lecturers', key: 'lecturerIds', sortable: false },
  { title: 'Actions', key: 'actions', sortable: false, align: 'end' as const },
]

function formatWeek(weekId: string): string {
  const w = weeks.value.find(x => (x.id || x._id) === weekId)
  return w ? `Week ${w.semesterWeek}` : weekId
}

function getModuleName(moduleId: string): string {
  const m = modules.value.find(x => (x.id || (x as any)._id) === moduleId)
  return m ? (m.code || m.name) : moduleId
}

function getRoomName(roomId: string): string {
  const r = rooms.value.find(x => x.id === roomId)
  return r ? r.name : roomId
}

function getClassName(classId: string): string {
  const c = classes.value.find(x => (x.id || x._id) === classId)
  return c ? (c.name || c.code || classId) : classId
}
function getLecturerName(lecturerId: string): string {
  const l = lecturers.value.find(x => (x.id || x._id) === lecturerId)
  return l ? l.name : lecturerId
}

const availabilityHeaders = [
  { title: 'Weekday', key: 'weekday', sortable: true },
  { title: 'Start', key: 'startTime', sortable: true },
  { title: 'End', key: 'endTime', sortable: true },
  { title: 'Actions', key: 'actions', sortable: false, align: 'end' as const },
]

const ruleHeaders = [
  { title: 'Rule Type', key: 'ruleType', sortable: true },
  { title: 'Category', key: 'category', sortable: true },
  { title: 'Enabled', key: 'enabled', sortable: true },
  { title: 'Priority', key: 'weight', sortable: true },
  { title: 'Description', key: 'description', sortable: true },
  { title: 'Applies To', key: 'appliesTo', sortable: false },
  { title: 'Actions', key: 'actions', sortable: false, align: 'end' as const },
]

const filteredAvailabilities = computed(() => {
  const q = availabilitySearch.value?.toLowerCase() || ''
  if (!q) return semesterAvailabilities.value
  return semesterAvailabilities.value.filter(a => {
    const weekday = WEEKDAY_LABELS[a.weekday as Weekday]?.toLowerCase() || ''
    return weekday.includes(q) || a.startTime.toLowerCase().includes(q) || a.endTime.toLowerCase().includes(q)
  })
})

const filteredRules = computed(() => {
  const q = ruleSearch.value?.toLowerCase() || ''
  if (!q) return semesterRules.value
  return semesterRules.value.filter(r =>
    r.ruleType.toLowerCase().includes(q) ||
    (r.description || '').toLowerCase().includes(q) ||
    r.category.includes(q) ||
    (r.appliesTo || []).some(t => t.toLowerCase().includes(q))
  )
})

function formatWeekday(wd: Weekday): string {
  return WEEKDAY_LABELS[wd] || wd
}

function getWeightLabel(weight: number): string {
  if (weight <= 1) return 'Nice to have'
  if (weight <= 5) return 'Preferred'
  if (weight <= 10) return 'Desired'
  return 'Almost mandatory'
}

function getWeightColor(weight: number): string {
  if (weight <= 1) return 'success'
  if (weight <= 5) return 'info'
  if (weight <= 10) return 'warning'
  return 'error'
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

// Week dialog
const weekDialogOpen = ref(false)
const editingWeek = ref<Week | null>(null)

function openAddWeek() {
  editingWeek.value = null
  weekDialogOpen.value = true
}

function openEditWeek(item: Week) {
  editingWeek.value = JSON.parse(JSON.stringify(item))
  weekDialogOpen.value = true
}

async function handleSaveWeek(week: Week) {
  try {
    if (week._id || week.id) {
      await updateWeek(week)
    } else {
      await addWeek(week)
    }
  } catch (e: any) {
    console.error('Failed to save week:', e)
  }
}

// Schedule entry dialog
const entryDialogOpen = ref(false)
const editingEntry = ref<ScheduleEntry | null>(null)

function openAddEntry() {
  editingEntry.value = null
  entryDialogOpen.value = true
}

function openEditEntry(item: ScheduleEntry) {
  editingEntry.value = JSON.parse(JSON.stringify(item))
  entryDialogOpen.value = true
}

async function handleSaveEntry(entry: ScheduleEntry) {
  try {
    if (entry._id || entry.id) {
      await updateScheduleEntry(entry)
    } else {
      await addScheduleEntry(entry)
    }
  } catch (e: any) {
    console.error('Failed to save schedule entry:', e)
  }
}

// Delete dialog
const deleteDialogOpen = ref(false)
const deleteTargetName = ref('')
type DeleteTarget = { type: 'availability' | 'rule' | 'week' | 'entry'; id: string }
let deleteTarget: DeleteTarget | null = null

function confirmDeleteAvailability(item: LecturerAvailability) {
  deleteTarget = { type: 'availability', id: item._id || item.id || '' }
  deleteTargetName.value = 'this availability entry'
  deleteDialogOpen.value = true
}

function confirmDeleteRule(item: SchedulingRule) {
  deleteTarget = { type: 'rule', id: item._id || item.id || '' }
  deleteTargetName.value = item.ruleType
  deleteDialogOpen.value = true
}

function confirmDeleteWeek(item: Week) {
  deleteTarget = { type: 'week', id: item._id || item.id || '' }
  deleteTargetName.value = `Week ${item.semesterWeek}`
  deleteDialogOpen.value = true
}

function confirmDeleteEntry(item: ScheduleEntry) {
  deleteTarget = { type: 'entry', id: item._id || item.id || '' }
  deleteTargetName.value = `this ${formatWeekday(item.weekday as Weekday)} entry`
  deleteDialogOpen.value = true
}

async function executeDelete() {
  if (!deleteTarget) return
  if (deleteTarget.type === 'availability') {
    await removeAvailability(deleteTarget.id)
  } else if (deleteTarget.type === 'rule') {
    await removeRule(deleteTarget.id)
  } else if (deleteTarget.type === 'week') {
    await removeWeek(deleteTarget.id)
  } else {
    await removeScheduleEntry(deleteTarget.id)
  }
  deleteTarget = null
  deleteDialogOpen.value = false
}

// CSV Import
const csvImportDialogOpen = ref(false)
const csvImportType = ref<'availability' | 'scheduling_rules' | 'weeks' | 'schedule_entries'>('availability')

function openCsvImport(type: 'availability' | 'scheduling_rules' | 'weeks' | 'schedule_entries') {
  csvImportType.value = type
  csvImportDialogOpen.value = true
}

async function handleCsvImported() {
  if (csvImportType.value === 'availability') {
    await fetchAvailabilities()
  } else if (csvImportType.value === 'weeks') {
    await fetchWeeks()
  } else if (csvImportType.value === 'schedule_entries') {
    await fetchScheduleEntries()
  } else {
    await fetchRules()
  }
}

onMounted(() => {
  store.fetchSemesters()
  store.fetchModules()
  store.fetchRooms()
  store.fetchLecturers()
  fetchAvailabilities()
  fetchRules()
  fetchWeeks()
  fetchScheduleEntries()
  fetchClasses()
})
</script>