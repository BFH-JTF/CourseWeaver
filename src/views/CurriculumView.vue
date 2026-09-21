<template>
  <v-container>
    <h1 class="mb-1">Curriculum</h1>
    <p class="text-body-2 text-medium-emphasis mb-4">
      Manage departments, programs, degrees, modules, classes, and semesters across the curriculum.
    </p>

    <v-tabs v-model="activeTab">
      <v-tab value="departments">Departments</v-tab>
      <v-tab value="programs">Programs</v-tab>
      <v-tab value="degrees">Degrees</v-tab>
      <v-tab value="modules">Modules</v-tab>
      <v-tab value="classes">Classes</v-tab>
      <v-tab value="semesters">Semesters</v-tab>
    </v-tabs>

    <v-window v-model="activeTab" class="mt-4">
      <!-- Departments Tab -->
      <v-window-item value="departments">
        <v-row class="align-center mb-4">
          <v-col cols="12" sm="6" class="d-flex ga-2">
            <v-btn v-if="auth.isAdmin" color="primary" prepend-icon="mdi-plus" @click="openAddDepartment">Add Department</v-btn>
            <v-btn v-if="auth.isAdmin" variant="outlined" prepend-icon="mdi-file-import" @click="openCsvImport('departments')">Import CSV</v-btn>
          </v-col>
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="deptSearch"
              prepend-inner-icon="mdi-magnify"
              label="Search departments"
              single-line
              hide-details
              clearable
              density="compact"
            />
          </v-col>
        </v-row>

        <v-data-table
          :headers="deptHeaders"
          :items="filteredDepartments"
          :sort-by="deptSortBy"
          @update:sort-by="deptSortBy = $event"
          hover
          items-per-page="15"
        >
          <template #item.description="{ item }">
            {{ item.description || '-' }}
          </template>
          <template #item.contact="{ item }">
            {{ item.contact || '-' }}
          </template>
          <template #item.url="{ item }">
            <a v-if="item.url || item.URL" :href="item.url || item.URL" target="_blank" rel="noopener" class="text-decoration-none">
              {{ item.url || item.URL }}
            </a>
            <span v-else class="text-medium-emphasis">-</span>
          </template>
          <template #item.name="{ item }">
            <span>{{ item.name }}</span>
            <v-chip v-if="item._canEdit" size="x-small" variant="tonal" color="primary" class="ml-1">Admin</v-chip>
          </template>
          <template #item.actions="{ item }">
            <template v-if="item._canEdit">
              <v-btn icon variant="text" size="small" @click="openEditDepartment(item)">
                <v-icon>mdi-pencil</v-icon>
                <v-tooltip activator="parent">Edit</v-tooltip>
              </v-btn>
              <v-btn icon variant="text" size="small" @click="confirmDeleteDepartment(item)">
                <v-icon>mdi-delete</v-icon>
                <v-tooltip activator="parent">Delete</v-tooltip>
              </v-btn>
            </template>
            <span v-else class="text-medium-emphasis text-caption">Read-only</span>
          </template>
          <template #no-data>
            <div class="text-center pa-4">
              <v-icon size="64" color="grey-lighten-1">mdi-domain</v-icon>
              <p class="mt-2 text-medium-emphasis">No departments found.</p>
            </div>
          </template>
        </v-data-table>
      </v-window-item>

      <!-- Programs Tab -->
      <v-window-item value="programs">
        <v-row class="align-center mb-4">
          <v-col cols="12" sm="6" class="d-flex ga-2">
            <v-btn v-if="auth.isAdmin" color="primary" prepend-icon="mdi-plus" @click="openAddProgram">Add Program</v-btn>
            <v-btn v-if="auth.isAdmin" variant="outlined" prepend-icon="mdi-file-import" @click="openCsvImport('programs')">Import CSV</v-btn>
          </v-col>
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="progSearch"
              prepend-inner-icon="mdi-magnify"
              label="Search programs"
              single-line
              hide-details
              clearable
              density="compact"
            />
          </v-col>
        </v-row>

        <v-data-table
          :headers="progHeaders"
          :items="filteredPrograms"
          :sort-by="progSortBy"
          @update:sort-by="progSortBy = $event"
          hover
          items-per-page="15"
        >
          <template #item.departmentIDs="{ item }">
            <template v-if="getDepartmentNames(item).length">
              <v-chip v-for="name in getDepartmentNames(item)" :key="name" size="x-small" variant="tonal" color="primary" class="mr-1">
                {{ name }}
              </v-chip>
            </template>
            <span v-else class="text-medium-emphasis">-</span>
          </template>
          <template #item.description="{ item }">
            {{ item.description || '-' }}
          </template>
          <template #item.contact="{ item }">
            {{ item.contact || '-' }}
          </template>
          <template #item.url="{ item }">
            <a v-if="item.url || item.URL" :href="item.url || item.URL" target="_blank" rel="noopener" class="text-decoration-none">
              {{ item.url || item.URL }}
            </a>
            <span v-else class="text-medium-emphasis">-</span>
          </template>
          <template #item.name="{ item }">
            <span>{{ item.name }}</span>
            <v-chip v-if="item._canEdit" size="x-small" variant="tonal" color="primary" class="ml-1">Admin</v-chip>
          </template>
          <template #item.actions="{ item }">
            <template v-if="item._canEdit">
              <v-btn icon variant="text" size="small" @click="openEditProgram(item)">
                <v-icon>mdi-pencil</v-icon>
                <v-tooltip activator="parent">Edit</v-tooltip>
              </v-btn>
              <v-btn icon variant="text" size="small" @click="confirmDeleteProgram(item)">
                <v-icon>mdi-delete</v-icon>
                <v-tooltip activator="parent">Delete</v-tooltip>
              </v-btn>
            </template>
            <span v-else class="text-medium-emphasis text-caption">Read-only</span>
          </template>
          <template #no-data>
            <div class="text-center pa-4">
              <v-icon size="64" color="grey-lighten-1">mdi-school-outline</v-icon>
              <p class="mt-2 text-medium-emphasis">No programs found.</p>
            </div>
          </template>
        </v-data-table>
      </v-window-item>

      <!-- Degrees Tab -->
      <v-window-item value="degrees">
        <v-row class="align-center mb-4">
          <v-col cols="12" sm="6" class="d-flex ga-2">
            <v-btn v-if="auth.isAdmin" color="primary" prepend-icon="mdi-plus" @click="openAddDegree">Add Degree</v-btn>
            <v-btn v-if="auth.isAdmin" variant="outlined" prepend-icon="mdi-file-import" @click="openCsvImport('degrees')">Import CSV</v-btn>
          </v-col>
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="degSearch"
              prepend-inner-icon="mdi-magnify"
              label="Search degrees"
              single-line
              hide-details
              clearable
              density="compact"
            />
          </v-col>
        </v-row>

        <v-data-table
          :headers="degHeaders"
          :items="filteredDegrees"
          :sort-by="degSortBy"
          @update:sort-by="degSortBy = $event"
          hover
          items-per-page="15"
        >
          <template #item.ProgramIDs="{ item }">
            <template v-if="getProgramNames(item).length">
              <v-chip v-for="name in getProgramNames(item)" :key="name" size="x-small" variant="tonal" color="secondary" class="mr-1">
                {{ name }}
              </v-chip>
            </template>
            <span v-else class="text-medium-emphasis">-</span>
          </template>
          <template #item.description="{ item }">
            {{ item.description || '-' }}
          </template>
          <template #item.contact="{ item }">
            {{ item.contact || '-' }}
          </template>
          <template #item.url="{ item }">
            <a v-if="item.url || item.URL" :href="item.url || item.URL" target="_blank" rel="noopener" class="text-decoration-none">
              {{ item.url || item.URL }}
            </a>
            <span v-else class="text-medium-emphasis">-</span>
          </template>
          <template #item.name="{ item }">
            <span>{{ item.name }}</span>
            <v-chip v-if="item._canEdit" size="x-small" variant="tonal" color="primary" class="ml-1">Admin</v-chip>
          </template>
          <template #item.actions="{ item }">
            <template v-if="item._canEdit">
              <v-btn icon variant="text" size="small" @click="openEditDegree(item)">
                <v-icon>mdi-pencil</v-icon>
                <v-tooltip activator="parent">Edit</v-tooltip>
              </v-btn>
              <v-btn icon variant="text" size="small" @click="confirmDeleteDegree(item)">
                <v-icon>mdi-delete</v-icon>
                <v-tooltip activator="parent">Delete</v-tooltip>
              </v-btn>
            </template>
            <span v-else class="text-medium-emphasis text-caption">Read-only</span>
          </template>
          <template #no-data>
            <div class="text-center pa-4">
              <v-icon size="64" color="grey-lighten-1">mdi-certificate-outline</v-icon>
              <p class="mt-2 text-medium-emphasis">No degrees found.</p>
            </div>
          </template>
        </v-data-table>
      </v-window-item>

      <!-- Modules Tab -->
      <v-window-item value="modules">
        <v-row class="align-center mb-4">
          <v-col cols="12" sm="6" class="d-flex ga-2">
            <v-btn v-if="auth.isAdmin" color="primary" prepend-icon="mdi-plus" @click="openAddModule">Add Module</v-btn>
            <v-btn v-if="auth.isAdmin" variant="outlined" prepend-icon="mdi-file-import" @click="openCsvImport('modules')">Import CSV</v-btn>
          </v-col>
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="modSearch"
              prepend-inner-icon="mdi-magnify"
              label="Search modules"
              single-line
              hide-details
              clearable
              density="compact"
            />
          </v-col>
        </v-row>

        <v-data-table
          :headers="modHeaders"
          :items="filteredModules"
          :sort-by="modSortBy"
          @update:sort-by="modSortBy = $event"
          hover
          items-per-page="15"
        >
          <template #item.code="{ item }">
            {{ item.code || '-' }}
          </template>
          <template #item.DegreeIDs="{ item }">
            <template v-if="getDegreeNames(item).length">
              <v-chip v-for="name in getDegreeNames(item)" :key="name" size="x-small" variant="tonal" color="teal" class="mr-1">
                {{ name }}
              </v-chip>
            </template>
            <span v-else class="text-medium-emphasis">-</span>
          </template>
          <template #item.creditPoints="{ item }">
            {{ item.creditPoints ?? '-' }}
          </template>
          <template #item.contactHours="{ item }">
            {{ item.contactHours ?? '-' }}
          </template>
          <template #item.selfStudyHours="{ item }">
            {{ item.selfStudyHours ?? '-' }}
          </template>
          <template #item.constraints="{ item }">
            <template v-if="item.constraints && item.constraints.length">
              <v-chip
                v-for="(c, idx) in item.constraints"
                :key="idx"
                size="x-small"
                :color="c.type === 'requires' ? 'info' : c.type === 'corequisite' ? 'warning' : 'error'"
                variant="tonal"
                class="mr-1"
              >
                {{ c.type }}: {{ getModuleName(c.targetModuleId) }}
              </v-chip>
            </template>
            <span v-else class="text-medium-emphasis">-</span>
          </template>
          <template #item.name="{ item }">
            <span>{{ item.name }}</span>
            <v-chip v-if="item._canEdit" size="x-small" variant="tonal" color="primary" class="ml-1">Admin</v-chip>
          </template>
          <template #item.actions="{ item }">
            <template v-if="item._canEdit">
              <v-btn icon variant="text" size="small" @click="openEditModule(item)">
                <v-icon>mdi-pencil</v-icon>
                <v-tooltip activator="parent">Edit</v-tooltip>
              </v-btn>
              <v-btn icon variant="text" size="small" @click="confirmDeleteModule(item)">
                <v-icon>mdi-delete</v-icon>
                <v-tooltip activator="parent">Delete</v-tooltip>
              </v-btn>
            </template>
            <span v-else class="text-medium-emphasis text-caption">Read-only</span>
          </template>
          <template #no-data>
            <div class="text-center pa-4">
              <v-icon size="64" color="grey-lighten-1">mdi-book-open-page-variant</v-icon>
              <p class="mt-2 text-medium-emphasis">No modules found.</p>
            </div>
          </template>
        </v-data-table>
      </v-window-item>

      <!-- Classes Tab -->
      <v-window-item value="classes">
        <v-row class="align-center mb-4">
          <v-col cols="12" sm="6" class="d-flex ga-2">
            <v-btn v-if="auth.isAdmin" color="primary" prepend-icon="mdi-plus" @click="openAddClass">Add Class</v-btn>
          </v-col>
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="clsSearch"
              prepend-inner-icon="mdi-magnify"
              label="Search classes"
              single-line
              hide-details
              clearable
              density="compact"
            />
          </v-col>
        </v-row>

        <v-data-table
          :headers="clsHeaders"
          :items="filteredClasses"
          :sort-by="clsSortBy"
          @update:sort-by="clsSortBy = $event"
          hover
          items-per-page="15"
        >
          <template #item.code="{ item }">
            {{ item.code || '-' }}
          </template>
          <template #item.startingYear="{ item }">
            {{ item.startingYear ?? item.year ?? '-' }}
          </template>
          <template #item.size="{ item }">
            {{ item.size ?? '-' }}
          </template>
          <template #item.programIds="{ item }">
            <template v-if="getClassProgramNames(item).length">
              <v-chip v-for="name in getClassProgramNames(item)" :key="name" size="x-small" variant="tonal" color="secondary" class="mr-1">
                {{ name }}
              </v-chip>
            </template>
            <span v-else class="text-medium-emphasis">-</span>
          </template>
          <template #item.semesterId="{ item }">
            {{ getSemesterName(item.semesterId) || '-' }}
          </template>
          <template #item.description="{ item }">
            {{ item.description || '-' }}
          </template>
          <template #item.contact="{ item }">
            {{ item.contact || '-' }}
          </template>
          <template #item.url="{ item }">
            <a v-if="item.url || item.URL" :href="item.url || item.URL" target="_blank" rel="noopener" class="text-decoration-none">
              {{ item.url || item.URL }}
            </a>
            <span v-else class="text-medium-emphasis">-</span>
          </template>
          <template #item.name="{ item }">
            <span>{{ item.name }}</span>
            <v-chip v-if="item._canEdit" size="x-small" variant="tonal" color="primary" class="ml-1">Admin</v-chip>
          </template>
          <template #item.actions="{ item }">
            <template v-if="item._canEdit">
              <v-btn icon variant="text" size="small" @click="openEditClass(item)">
                <v-icon>mdi-pencil</v-icon>
                <v-tooltip activator="parent">Edit</v-tooltip>
              </v-btn>
              <v-btn icon variant="text" size="small" @click="confirmDeleteClass(item)">
                <v-icon>mdi-delete</v-icon>
                <v-tooltip activator="parent">Delete</v-tooltip>
              </v-btn>
            </template>
            <span v-else class="text-medium-emphasis text-caption">Read-only</span>
          </template>
          <template #no-data>
            <div class="text-center pa-4">
              <v-icon size="64" color="grey-lighten-1">mdi-account-group</v-icon>
              <p class="mt-2 text-medium-emphasis">No classes found.</p>
            </div>
          </template>
        </v-data-table>
      </v-window-item>

      <!-- Semesters Tab -->
      <v-window-item value="semesters">
        <v-row class="align-center mb-4">
          <v-col cols="12" sm="6" class="d-flex ga-2">
            <v-btn v-if="auth.isAdmin" color="primary" prepend-icon="mdi-plus" @click="openAddSemester">Add Semester</v-btn>
          </v-col>
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="semSearch"
              prepend-inner-icon="mdi-magnify"
              label="Search semesters"
              single-line
              hide-details
              clearable
              density="compact"
            />
          </v-col>
        </v-row>

        <v-data-table
          :headers="semHeaders"
          :items="filteredSemesters"
          :sort-by="semSortBy"
          @update:sort-by="semSortBy = $event"
          hover
          items-per-page="15"
        >
          <template #item.identifier="{ item }">
            <span class="font-weight-medium">{{ item.name || item.identifier }}</span>
          </template>
          <template #item.startDate="{ item }">
            {{ formatDate(item.startDate) }}
          </template>
          <template #item.endDate="{ item }">
            {{ formatDate(item.endDate) }}
          </template>
          <template #item.holidays="{ item }">
            <template v-if="item.holidays && item.holidays.length">
              <v-chip v-for="(h, idx) in item.holidays" :key="idx" size="x-small" variant="tonal" color="warning" class="mr-1">
                {{ h.label || `${h.start}–${h.end}` }}
              </v-chip>
            </template>
            <span v-else class="text-medium-emphasis">—</span>
          </template>
          <template #item.specialDates="{ item }">
            <template v-if="item.specialDates && item.specialDates.length">
              <v-chip v-for="(sd, idx) in item.specialDates" :key="idx" size="x-small" variant="tonal" color="info" class="mr-1">
                {{ sd.label || `${sd.start}–${sd.end}` }}
              </v-chip>
            </template>
            <span v-else class="text-medium-emphasis">—</span>
          </template>
          <template #item.actions="{ item }">
            <template v-if="auth.isAdmin">
              <v-btn icon variant="text" size="small" @click="openEditSemester(item)">
                <v-icon>mdi-pencil</v-icon>
                <v-tooltip activator="parent">Edit</v-tooltip>
              </v-btn>
              <v-btn icon variant="text" size="small" @click="confirmDeleteSemester(item)">
                <v-icon>mdi-delete</v-icon>
                <v-tooltip activator="parent">Delete</v-tooltip>
              </v-btn>
            </template>
            <span v-else class="text-medium-emphasis text-caption">Read-only</span>
          </template>
          <template #no-data>
            <div class="text-center pa-4">
              <v-icon size="64" color="grey-lighten-1">mdi-school-outline</v-icon>
              <p class="mt-2 text-medium-emphasis">No semesters found.</p>
              <p class="text-caption text-medium-emphasis">Add a semester to define scheduling periods.</p>
            </div>
          </template>
        </v-data-table>
      </v-window-item>
    </v-window>

    <DepartmentFormDialog
      v-model="deptDialogOpen"
      :department-data="editDepartment"
      @save="handleDepartmentSave"
    />

    <ProgramFormDialog
      v-model="progDialogOpen"
      :program-data="editProgram"
      :departments="departments"
      @save="handleProgramSave"
    />

    <DegreeFormDialog
      v-model="degDialogOpen"
      :degree-data="editDegree"
      :programs="programs"
      @save="handleDegreeSave"
    />

    <ModuleFormDialog
      v-model="modDialogOpen"
      :module-data="editModule"
      :degrees="degrees"
      @save="handleModuleSave"
    />

    <ClassFormDialog
      v-model="clsDialogOpen"
      :class-data="editClass"
      :programs="programs"
      :semesters="semesterList"
      @save="handleClassSave"
    />

    <SemesterFormDialog
      v-model="semDialogOpen"
      :semester-data="editSemester"
      @save="handleSemesterSave"
    />

    <CsvImportDialog
      v-model="csvImportDialogOpen"
      :initial-type="csvImportType"
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
import { useDepartments } from '@/composables/useDepartments'
import { usePrograms } from '@/composables/usePrograms'
import { useDegrees } from '@/composables/useDegrees'
import { useModules } from '@/composables/useModules'
import { useSemesters } from '@/composables/useSemesters'
import { useClasses } from '@/composables/useClasses'
import { useAuthStore } from '@/stores/auth'
import DepartmentFormDialog from '@/components/DepartmentFormDialog.vue'
import ProgramFormDialog from '@/components/ProgramFormDialog.vue'
import DegreeFormDialog from '@/components/DegreeFormDialog.vue'
import ModuleFormDialog from '@/components/ModuleFormDialog.vue'
import ClassFormDialog from '@/components/ClassFormDialog.vue'
import SemesterFormDialog from '@/components/SemesterFormDialog.vue'
import CsvImportDialog from '@/components/CsvImportDialog.vue'
import type { Department, Program, Degree, Module } from '@/types/curriculum'
import type { ClassEntity } from '@/types/curriculumClass'
import type { Semester } from '@/stores/curriculum'
import type { ImportType } from '@/types/csvImport'

const auth = useAuthStore()

const {
  departments,
  fetchDepartments,
  addDepartment,
  updateDepartment,
  removeDepartment,
} = useDepartments()

const {
  programs,
  fetchPrograms,
  addProgram,
  updateProgram,
  removeProgram,
} = usePrograms()

const {
  degrees,
  fetchDegrees,
  addDegree,
  updateDegree,
  removeDegree,
} = useDegrees()

const {
  modules,
  fetchModules,
  addModule,
  updateModule,
  removeModule,
} = useModules()

const {
  classes,
  fetchClasses,
  addClass,
  updateClass,
  removeClass,
} = useClasses()

const {
  semesters: semesterList,
  fetchSemesters,
  addSemester,
  updateSemester,
  removeSemester,
} = useSemesters()

const activeTab = ref<'departments' | 'programs' | 'degrees' | 'modules' | 'classes' | 'semesters'>('departments')

const deptSearch = ref('')
const deptDialogOpen = ref(false)
const editDepartment = ref<Department | undefined>(undefined)
const deptSortBy = ref<{ key: string; order: 'asc' | 'desc' }[]>([])

const progSearch = ref('')
const progDialogOpen = ref(false)
const editProgram = ref<Program | undefined>(undefined)
const progSortBy = ref<{ key: string; order: 'asc' | 'desc' }[]>([])

const degSearch = ref('')
const degDialogOpen = ref(false)
const editDegree = ref<Degree | undefined>(undefined)
const degSortBy = ref<{ key: string; order: 'asc' | 'desc' }[]>([])

const modSearch = ref('')
const modDialogOpen = ref(false)
const editModule = ref<Module | undefined>(undefined)
const modSortBy = ref<{ key: string; order: 'asc' | 'desc' }[]>([])

const clsSearch = ref('')
const clsDialogOpen = ref(false)
const editClass = ref<ClassEntity | undefined>(undefined)
const clsSortBy = ref<{ key: string; order: 'asc' | 'desc' }[]>([])

const semSearch = ref('')
const semDialogOpen = ref(false)
const editSemester = ref<Semester | null>(null)
const semSortBy = ref<{ key: string; order: 'asc' | 'desc' }[]>([{ key: 'startDate', order: 'desc' }])

const csvImportDialogOpen = ref(false)
const csvImportType = ref<ImportType>('departments')

const deleteDialogOpen = ref(false)
const deleteTargetName = ref('')
let deleteKind: 'department' | 'program' | 'degree' | 'module' | 'class' | 'semester' = 'department'
let deleteId = ''

const snackbar = ref(false)
const snackbarText = ref('')
const snackbarColor = ref('success')

const deptHeaders = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Description', key: 'description', sortable: true },
  { title: 'Contact', key: 'contact', sortable: true },
  { title: 'URL', key: 'url', sortable: true },
  { title: '', key: 'actions', sortable: false, width: '100px' },
]

const progHeaders = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Departments', key: 'departmentIDs', sortable: false },
  { title: 'Description', key: 'description', sortable: true },
  { title: 'Contact', key: 'contact', sortable: true },
  { title: 'URL', key: 'url', sortable: true },
  { title: '', key: 'actions', sortable: false, width: '100px' },
]

const degHeaders = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Programs', key: 'ProgramIDs', sortable: false },
  { title: 'Description', key: 'description', sortable: true },
  { title: 'Contact', key: 'contact', sortable: true },
  { title: 'URL', key: 'url', sortable: true },
  { title: '', key: 'actions', sortable: false, width: '100px' },
]

const modHeaders = [
  { title: 'Code', key: 'code', sortable: true },
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Degrees', key: 'DegreeIDs', sortable: false },
  { title: 'ECTS', key: 'creditPoints', sortable: true },
  { title: 'Contact hrs', key: 'contactHours', sortable: true },
  { title: 'Self-study', key: 'selfStudyHours', sortable: true },
  { title: 'Constraints', key: 'constraints', sortable: false },
  { title: '', key: 'actions', sortable: false, width: '100px' },
]

const clsHeaders = [
  { title: 'Code', key: 'code', sortable: true },
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Programs', key: 'programIds', sortable: false },
  { title: 'Starting Year', key: 'startingYear', sortable: true },
  { title: 'Size', key: 'size', sortable: true },
  { title: 'Semester', key: 'semesterId', sortable: false },
  { title: 'Description', key: 'description', sortable: true },
  { title: 'Contact', key: 'contact', sortable: true },
  { title: '', key: 'actions', sortable: false, width: '100px' },
]

const semHeaders = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Start', key: 'startDate', sortable: true },
  { title: 'End', key: 'endDate', sortable: true },
  { title: 'Holidays', key: 'holidays', sortable: false },
  { title: 'Special Dates', key: 'specialDates', sortable: false },
  { title: '', key: 'actions', sortable: false, width: '100px' },
]

function getDepartmentNames(prog: Program): string[] {
  const ids = prog.departmentIDs ?? prog.departmentIds ?? []
  return ids.map(id => {
    const dept = departments.value.find(d => d.id === id)
    return dept ? dept.name : id
  })
}

function getProgramNames(deg: Degree): string[] {
  const ids = deg.ProgramIDs ?? deg.programIDs ?? deg.programIds ?? []
  return ids.map(id => {
    const prog = programs.value.find(p => p.id === id)
    return prog ? prog.name : id
  })
}

function getDegreeNames(mod: Module): string[] {
  const ids = mod.DegreeIDs ?? mod.degreeIDs ?? mod.degreeIds ?? []
  return ids.map(id => {
    const deg = degrees.value.find(d => d.id === id)
    return deg ? deg.name : id
  })
}

function getModuleName(moduleId: string): string {
  const mod = modules.value.find(m => m.id === moduleId)
  return mod ? (mod.code || mod.name) : moduleId
}

function getClassProgramNames(cls: ClassEntity): string[] {
  const ids = cls.programIds ?? []
  return ids.map((id: string) => {
    const prog = programs.value.find(p => p.id === id)
    return prog ? prog.name : id
  })
}

function getSemesterName(semesterId: string | undefined): string {
  if (!semesterId) return ''
  const sem = semesterList.value.find(s => (s._id || s.id) === semesterId)
  return sem ? (sem.name ?? sem.identifier ?? '') : semesterId
}

const filteredDepartments = computed(() => {
  if (!deptSearch.value) return departments.value
  const q = deptSearch.value.toLowerCase()
  return departments.value.filter(d =>
    d.name.toLowerCase().includes(q) ||
    (d.description ?? '').toLowerCase().includes(q) ||
    (d.contact ?? '').toLowerCase().includes(q)
  )
})

const filteredPrograms = computed(() => {
  if (!progSearch.value) return programs.value
  const q = progSearch.value.toLowerCase()
  return programs.value.filter(p =>
    p.name.toLowerCase().includes(q) ||
    (p.description ?? '').toLowerCase().includes(q) ||
    (p.contact ?? '').toLowerCase().includes(q) ||
    getDepartmentNames(p).some(n => n.toLowerCase().includes(q))
  )
})

const filteredDegrees = computed(() => {
  if (!degSearch.value) return degrees.value
  const q = degSearch.value.toLowerCase()
  return degrees.value.filter(d =>
    d.name.toLowerCase().includes(q) ||
    (d.description ?? '').toLowerCase().includes(q) ||
    (d.contact ?? '').toLowerCase().includes(q) ||
    getProgramNames(d).some(n => n.toLowerCase().includes(q))
  )
})

const filteredModules = computed(() => {
  if (!modSearch.value) return modules.value
  const q = modSearch.value.toLowerCase()
  return modules.value.filter(m =>
    m.name.toLowerCase().includes(q) ||
    (m.code ?? '').toLowerCase().includes(q) ||
    (m.description ?? '').toLowerCase().includes(q) ||
    (m.contact ?? '').toLowerCase().includes(q) ||
    getDegreeNames(m).some(n => n.toLowerCase().includes(q))
  )
})

const filteredClasses = computed(() => {
  if (!clsSearch.value) return classes.value
  const q = clsSearch.value.toLowerCase()
  return classes.value.filter(c =>
    c.name.toLowerCase().includes(q) ||
    (c.code ?? '').toLowerCase().includes(q) ||
    (c.description ?? '').toLowerCase().includes(q) ||
    (c.contact ?? '').toLowerCase().includes(q) ||
    getClassProgramNames(c).some(n => n.toLowerCase().includes(q))
  )
})

const filteredSemesters = computed(() => {
  if (!semSearch.value) return semesterList.value
  const q = semSearch.value.toLowerCase()
  return semesterList.value.filter(s =>
    (s.name ?? s.identifier ?? '').toLowerCase().includes(q)
  )
})

function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleDateString()
  } catch {
    return dateStr
  }
}

function openAddDepartment() {
  editDepartment.value = undefined
  deptDialogOpen.value = true
}

function openEditDepartment(dept: Department) {
  editDepartment.value = dept
  deptDialogOpen.value = true
}

async function handleDepartmentSave(dept: Department) {
  try {
    if (dept.id) {
      await updateDepartment(dept)
      showSnackbar('Department updated')
    } else {
      await addDepartment(dept)
      showSnackbar('Department added')
    }
  } catch {
    showSnackbar('Operation failed', 'error')
  }
}

function confirmDeleteDepartment(dept: Department) {
  deleteKind = 'department'
  deleteId = dept.id ?? ''
  deleteTargetName.value = dept.name
  deleteDialogOpen.value = true
}

function openAddProgram() {
  editProgram.value = undefined
  progDialogOpen.value = true
}

function openEditProgram(prog: Program) {
  editProgram.value = prog
  progDialogOpen.value = true
}

async function handleProgramSave(prog: Program) {
  try {
    if (prog.id) {
      await updateProgram(prog)
      showSnackbar('Program updated')
    } else {
      await addProgram(prog)
      showSnackbar('Program added')
    }
  } catch {
    showSnackbar('Operation failed', 'error')
  }
}

function confirmDeleteProgram(prog: Program) {
  deleteKind = 'program'
  deleteId = prog.id ?? ''
  deleteTargetName.value = prog.name
  deleteDialogOpen.value = true
}

function openAddDegree() {
  editDegree.value = undefined
  degDialogOpen.value = true
}

function openEditDegree(deg: Degree) {
  editDegree.value = deg
  degDialogOpen.value = true
}

async function handleDegreeSave(deg: Degree) {
  try {
    if (deg.id) {
      await updateDegree(deg)
      showSnackbar('Degree updated')
    } else {
      await addDegree(deg)
      showSnackbar('Degree added')
    }
  } catch {
    showSnackbar('Operation failed', 'error')
  }
}

function confirmDeleteDegree(deg: Degree) {
  deleteKind = 'degree'
  deleteId = deg.id ?? ''
  deleteTargetName.value = deg.name
  deleteDialogOpen.value = true
}

function openAddModule() {
  editModule.value = undefined
  modDialogOpen.value = true
}

function openEditModule(mod: Module) {
  editModule.value = mod
  modDialogOpen.value = true
}

async function handleModuleSave(mod: Module) {
  try {
    if (mod.id) {
      await updateModule(mod)
      showSnackbar('Module updated')
    } else {
      await addModule(mod)
      showSnackbar('Module added')
    }
  } catch {
    showSnackbar('Operation failed', 'error')
  }
}

function confirmDeleteModule(mod: Module) {
  deleteKind = 'module'
  deleteId = mod.id ?? ''
  deleteTargetName.value = mod.name
  deleteDialogOpen.value = true
}

function openAddClass() {
  editClass.value = undefined
  clsDialogOpen.value = true
}

function openEditClass(cls: ClassEntity) {
  editClass.value = cls
  clsDialogOpen.value = true
}

async function handleClassSave(cls: ClassEntity) {
  try {
    if (cls.id) {
      await updateClass(cls)
      showSnackbar('Class updated')
    } else {
      await addClass(cls)
      showSnackbar('Class added')
    }
  } catch {
    showSnackbar('Operation failed', 'error')
  }
}

function confirmDeleteClass(cls: ClassEntity) {
  deleteKind = 'class'
  deleteId = cls.id ?? ''
  deleteTargetName.value = cls.name
  deleteDialogOpen.value = true
}

function openAddSemester() {
  editSemester.value = null
  semDialogOpen.value = true
}

function openEditSemester(sem: Semester) {
  editSemester.value = JSON.parse(JSON.stringify(sem))
  semDialogOpen.value = true
}

async function handleSemesterSave(sem: Semester) {
  try {
    if (sem._id || sem.id) {
      await updateSemester(sem)
      showSnackbar('Semester updated')
    } else {
      await addSemester(sem)
      showSnackbar('Semester added')
    }
  } catch {
    showSnackbar('Operation failed', 'error')
  }
}

function confirmDeleteSemester(sem: Semester) {
  deleteKind = 'semester'
  deleteId = sem._id || sem.id || ''
  deleteTargetName.value = sem.name ?? sem.identifier ?? 'Unnamed Semester'
  deleteDialogOpen.value = true
}

async function handleDelete() {
  try {
    if (deleteKind === 'department') {
      await removeDepartment(deleteId)
      showSnackbar('Department deleted')
    } else if (deleteKind === 'program') {
      await removeProgram(deleteId)
      showSnackbar('Program deleted')
    } else if (deleteKind === 'degree') {
      await removeDegree(deleteId)
      showSnackbar('Degree deleted')
    } else if (deleteKind === 'class') {
      await removeClass(deleteId)
      showSnackbar('Class deleted')
    } else if (deleteKind === 'semester') {
      await removeSemester(deleteId)
      showSnackbar('Semester deleted')
    } else {
      await removeModule(deleteId)
      showSnackbar('Module deleted')
    }
  } catch {
    showSnackbar('Deletion failed', 'error')
  }
  deleteDialogOpen.value = false
}

function openCsvImport(type: ImportType) {
  csvImportType.value = type
  csvImportDialogOpen.value = true
}

async function handleCsvImported(payload: { type: ImportType; count: number; items: any[] }) {
  const labelMap: Record<string, string> = {
    departments: 'department',
    programs: 'program',
    degrees: 'degree',
    modules: 'module',
  }
  if (payload.type === 'departments') {
    await fetchDepartments()
  } else if (payload.type === 'programs') {
    await fetchPrograms()
  } else if (payload.type === 'degrees') {
    await fetchDegrees()
  } else if (payload.type === 'modules') {
    await fetchModules()
  }
  const singular = labelMap[payload.type] || payload.type
  showSnackbar(`${payload.count} ${singular}${payload.count === 1 ? '' : 's'} imported successfully`)
}

function showSnackbar(text: string, color: string = 'success') {
  snackbarText.value = text
  snackbarColor.value = color
  snackbar.value = true
}

onMounted(() => {
  fetchDepartments()
  fetchPrograms()
  fetchDegrees()
  fetchModules()
  fetchClasses()
  fetchSemesters()
})
</script>