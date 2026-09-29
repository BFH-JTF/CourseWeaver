<template>
  <v-container fluid>
    <div class="d-flex align-center ga-3 mb-1">
      <h1 class="text-h4 font-weight-bold">Todos</h1>
      <span class="text-body-2 text-medium-emphasis">{{ openCount }} offen</span>
      <v-btn-toggle v-model="viewMode" mandatory density="compact" variant="outlined" class="ms-auto">
        <v-btn value="board" prepend-icon="mdi-view-column">Board</v-btn>
        <v-btn value="list" prepend-icon="mdi-format-list-bulleted">Liste</v-btn>
      </v-btn-toggle>
    </div>
    <p class="text-body-2 text-medium-emphasis mb-4">
      Kanban je Programm: Backlog, „bald fällig“ (= Enddatum in den nächsten 2 Wochen),
      in Bearbeitung, erledigt. Karten zwischen Spalten ziehen ändert den Status (persistiert).
    </p>

    <v-row dense class="mb-4">
      <v-col cols="12" md="4">
        <v-select
          v-model="programFilter"
          :items="['all', ...programIds].map(v => ({ title: v === 'all' ? 'Alle Programme' : programTitle(v), value: v }))"
          label="Programm" variant="outlined" density="compact" hide-details
        />
      </v-col>
      <v-col cols="12" md="4">
        <v-select
          v-model="sourceFilter"
          :items="['all', ...sources].map(v => ({ title: v === 'all' ? 'Alle Quellen' : sourceLabel(v), value: v }))"
          label="Quelle" variant="outlined" density="compact" hide-details
        />
      </v-col>
    </v-row>

    <!-- Kanban-Board -->
    <template v-if="viewMode === 'board'">
      <v-row dense>
        <v-col v-for="col in columns" :key="col.key" cols="12" md="3">
          <v-card
            variant="outlined"
            class="board-col pa-2"
            :class="{ 'drop-target': dragOverCol === col.key }"
            @dragover.prevent
            @dragenter.prevent="dragOverCol = col.key"
            @dragleave="dragOverCol === col.key && (dragOverCol = null)"
            @drop.prevent="onDropColumn(col)"
          >
            <div class="d-flex align-center justify-space-between mb-2">
              <div class="text-subtitle-1 font-weight-bold">{{ col.title }}</div>
              <v-chip size="x-small" :color="col.chipColor" label>{{ cardsFor(col.key).length }}</v-chip>
            </div>

            <v-sheet
              v-for="t in cardsFor(col.key)" :key="t._id"
              class="pa-2 mb-2 border rounded todo-card"
              :class="{ 'overdue': isOverdue(t) }"
              draggable="true"
              @dragstart="onDragStartTodo(t, $event)"
            >
              <div class="text-body-2 font-weight-medium">{{ t.title }}</div>
              <div class="text-caption text-medium-emphasis">
                {{ t.program_id ? programTitle(t.program_id) : '—' }} · {{ sourceLabel(t.source) }}
              </div>
              <div class="d-flex align-center ga-1 mt-1 flex-wrap">
                <v-chip size="x-small" :color="dueColor(t)" label>
                  {{ t.due_date ? 'bis ' + formatDate(t.due_date) : 'kein Enddatum' }}
                </v-chip>
                <template v-if="col.key !== 'done'">
                  <v-btn
                    size="x-small" icon="mdi-check" variant="text" color="success"
                    @click="moveTodo(t, 'done')"
                  />
                  <v-btn
                    v-if="col.key !== 'wip'"
                    size="x-small" icon="mdi-play" variant="text" color="info"
                    @click="moveTodo(t, 'wip')"
                  />
                </template>
                <v-btn
                  v-else size="x-small" icon="mdi-undo" variant="text"
                  @click="moveTodo(t, 'backlog')"
                />
              </div>
            </v-sheet>
            <div v-if="cardsFor(col.key).length === 0" class="text-caption text-disabled pa-2">
              leer — Karte hierher ziehen
            </div>
          </v-card>
        </v-col>
      </v-row>
    </template>

    <!-- Listenansicht -->
    <template v-else>
      <v-list lines="two" class="border rounded">
        <v-list-item v-for="t in boardTodos" :key="t._id">
          <template #prepend>
            <v-icon :color="iconColor(t.source)">{{ iconFor(t.source) }}</v-icon>
          </template>
          <template #append>
            <v-chip size="small" :color="chipColor(t.source)" class="me-2">{{ sourceLabel(t.source) }}</v-chip>
          </template>
          <v-list-item-title>{{ t.title }}</v-list-item-title>
          <v-list-item-subtitle>
            {{ t.program_id ? programTitle(t.program_id) : '—' }}
            <template v-if="t.due_date"> · bis {{ formatDate(t.due_date) }}</template>
          </v-list-item-subtitle>
        </v-list-item>
      </v-list>
    </template>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { usePlanning, computeConflicts, type Todo } from '@/composables/usePlanning'

const SOURCE_LABEL: Record<string, string> = {
  unconfirmed_module: 'Modul unbestätigt',
  missing_rubric: 'Rubrik fehlt',
  missing_aol_point: 'AoL-Messpunkt fehlt',
  schedule_conflict: 'Terminkonflikt',
  manual: 'Manuell',
}

const {
  todos, blocks, instructorAvailability, moduleById, programById, load,
} = usePlanning()

const viewMode = ref<'board' | 'list'>('board')
const programFilter = ref('all')
const sourceFilter = ref('all')

const programIds = computed<string[]>(() =>
  [...new Set(todos.value.map(t => t.program_id).filter((v): v is string => !!v))],
)

function programTitle(pid: string): string {
  return programById(pid)?.title ?? programById(pid)?.name ?? pid
}

const sources = ['unconfirmed_module', 'missing_rubric', 'missing_aol_point', 'schedule_conflict', 'manual']

function sourceLabel(source: string): string {
  return SOURCE_LABEL[source] ?? source
}
function iconColor(source: string): string {
  return source === 'schedule_conflict' ? 'error' : ''
}
function iconFor(source: string): string {
  return source === 'schedule_conflict' ? 'mdi-clock-alert-outline' : 'mdi-alert-circle-outline'
}
function chipColor(source: string): string {
  return source === 'schedule_conflict' ? 'error' : 'warning'
}

const today = new Date().toISOString().slice(0, 10)
const twoWeeks = (() => {
  const d = new Date()
  d.setDate(d.getDate() + 14)
  return d.toISOString().slice(0, 10)
})()

/** Terminangabe: dynamische Konflikte erben das Slot-Datum ( meist ≤ 14 Tage → „bald fällig“). */
const dynamicConflictTodos = computed<Todo[]>(() => {
  const conflicts = computeConflicts(blocks.value, instructorAvailability.value)
  const out: Todo[] = []
  for (const [blockId, reasons] of conflicts.entries()) {
    if (reasons.size === 0) continue
    const block = blocks.value.find(b => b._id === blockId)
    const m = moduleById(block?.module_id ?? '')
    out.push({
      _id: `conflict-${blockId}`,
      title: `Terminkonflikt bei '${m?.title ?? blockId}' klären`,
      description: [...reasons].join(', '),
      program_id: m?.program_id,
      source: 'schedule_conflict',
      status: 'open',
      created_date: block?.slots?.[0]?.date ?? today,
      due_date: block?.slots?.[0]?.date ?? today,
    })
  }
  return out
})

const boardTodos = computed<Todo[]>(() => {
  const base = [...todos.value, ...dynamicConflictTodos.value]
  return base.filter(t =>
    (programFilter.value === 'all' || t.program_id === programFilter.value) &&
    (sourceFilter.value === 'all' || t.source === sourceFilter.value),
  )
})

function isDueSoon(t: Todo): boolean {
  return !!t.due_date && t.due_date >= today && t.due_date <= twoWeeks
}

const columns = [
  { key: 'backlog', title: 'Todos', chipColor: 'default' },
  { key: 'soon', title: 'bald fällig', chipColor: 'warning' },
  { key: 'wip', title: 'in Bearbeitung', chipColor: 'info' },
  { key: 'done', title: 'erledigt', chipColor: 'success' },
]

const dragOverCol = ref<string | null>(null)
const draggingTodo = ref<Todo | null>(null)

function onDragStartTodo(t: Todo, evt: DragEvent): void {
  evt.dataTransfer?.setData('text/plain', t._id)
  draggingTodo.value = t
}

function columnOf(t: Todo): string {
  if (t.status === 'done') return 'done'
  if (t.status === 'in_progress') return 'wip'
  return isDueSoon(t) ? 'soon' : 'backlog'
}

function cardsFor(colKey: string): Todo[] {
  return boardTodos.value.filter(t => columnOf(t) === colKey)
}

async function moveTodo(t: Todo, target: 'backlog' | 'soon' | 'wip' | 'done'): Promise<void> {
  const status = target === 'wip' ? 'in_progress' : target === 'done' ? 'done' : 'open'
  t.status = status
  // persistente Todos: PUT; dynamische Konflikt-Todos (Konflikt pseudo-IDs) bleiben lokal
  if (!t._id.startsWith('conflict-')) {
    void fetch(`/api/todos/${encodeURIComponent(t._id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
  }
}

function onDropColumn(col: { key: string }): void {
  dragOverCol.value = null
  const t = draggingTodo.value
  if (!t) return
  void moveTodo(t, asTarget(col.key))
}

function asTarget(key: string): 'backlog' | 'soon' | 'wip' | 'done' {
  return (key === 'soon' ? 'soon' : key === 'wip' ? 'wip' : key === 'done' ? 'done' : 'backlog') as 'backlog' | 'soon' | 'wip' | 'done'
}

const openCount = computed(() => boardTodos.value.filter(x => x.status !== 'done').length)

function isOverdue(t: Todo): boolean {
  return !!t.due_date && t.due_date < today && t.status !== 'done'
}

function dueColor(t: Todo): string {
  return isOverdue(t) ? 'error' : isDueSoon(t) ? 'warning' : 'grey'
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

onMounted(() => {
  void load()
})
</script>

<style scoped>
.board-col {
  min-height: 55vh;
  background: rgba(0, 0, 0, 0.02);
}
.drop-target {
  outline: 2px dashed rgba(25, 118, 210, 0.6);
}
.todo-card {
  cursor: grab;
  transition: box-shadow .15s;
}
.todo-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,.08); }
.overdue { border-color: var(--v-theme-error, #b00020) !important; }
</style>
