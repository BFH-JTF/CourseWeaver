<template>
  <v-container>
    <h1>Schedule Creation</h1>
    <p class="text-body-1 mt-2 mb-4">
      Create and manage semester schedules. Define time frames, assign lecturers and rooms to sessions.
    </p>
    <v-alert type="info" variant="tonal" class="mb-4">
      Scheduling features are coming soon. This view will allow you to create timetables, set module constraints
      (block weeks, weekly/biweekly), and manage semester dates.
    </v-alert>

    <v-card class="mb-6">
      <v-card-title>CP-SAT Stundenplan (or-tools-wasm)</v-card-title>
      <v-card-text>
        <p class="text-body-2 mb-3">
          Echter CP-SAT via WebAssembly (<code>or-tools-wasm/cp-sat</code>). Läuft im Browser mit
          <code>Cross-Origin-Opener-Policy: same-origin</code> &amp; <code>Cross-Origin-Embedder-Policy: require-corp</code>
          (siehe <code>vite.config.ts</code>).
        </p>
        <div class="d-flex flex-wrap ga-2 mb-4">
          <v-btn color="primary" :loading="solvingSimple" @click="runSimpleDemo">Simple Demo (desks/tables)</v-btn>
          <v-btn color="secondary" :loading="solvingTimetable" @click="runTimetableDemo">Stundenplan Demo (6 Blöcke)</v-btn>
        </div>
        <v-alert v-if="simpleResult" type="success" variant="tonal" class="mb-3">
          Simple: {{ simpleResult.status }} — desks={{ simpleResult.desks }}, tables={{ simpleResult.tables }}, profit={{ simpleResult.profit }}
        </v-alert>
        <v-alert v-if="timetableResult" :type="timetableResult.status === 'OPTIMAL' || timetableResult.status === 'FEASIBLE' ? 'success' : 'error'" variant="tonal" class="mb-3">
          Stundenplan: {{ timetableResult.status }} ({{ timetableResult.solveTimeMs }} ms, Obj {{ timetableResult.objectiveValue }})
        </v-alert>
        <v-table v-if="timetableResult?.assignments?.length" density="compact">
          <thead><tr><th>Block</th><th>Slot (Datum/Periode)</th><th>Raum</th></tr></thead>
          <tbody>
            <tr v-for="a in timetableResult.assignments" :key="a.blockId">
              <td>{{ a.blockId }}</td><td>{{ a.slot.date }} {{ a.slot.weekday }} {{ a.slot.period }}</td><td>{{ roomName(a.roomId) }}</td>
            </tr>
          </tbody>
        </v-table>
        <v-alert v-if="error" type="error" variant="tonal">{{ error }}</v-alert>
      </v-card-text>
    </v-card>
    <v-row>
      <v-col cols="12" md="6">
        <v-card>
          <v-card-title>Semesters</v-card-title>
          <v-card-text>
            <v-list>
              <v-list-item v-for="s in semesters" :key="s._id" :title="s.identifier" :subtitle="`${s.startDate} – ${s.endDate}`" />
              <v-list-item v-if="semesters.length === 0" title="No semesters defined yet" />
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="6">
        <v-card>
          <v-card-title>Lecturers</v-card-title>
          <v-card-text>
            <v-list>
              <v-list-item v-for="l in lecturers" :key="l._id" :title="l.name" :subtitle="l.department" />
              <v-list-item v-if="lecturers.length === 0" title="No lecturers defined yet" />
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useCurriculumStore } from '@/stores/curriculum'
import { solveSimpleDemo, solveTimetable } from '@/composables/useTimetableCpSat'

const store = useCurriculumStore()
const { semesters, lecturers, rooms } = storeToRefs(store)

const solvingSimple = ref(false)
const solvingTimetable = ref(false)
const simpleResult = ref<any>(null)
const timetableResult = ref<any>(null)
const error = ref<string | null>(null)

function roomName(id: string) {
  return rooms.value.find((r: any) => r._id === id || r.id === id)?.name ?? id
}

async function runSimpleDemo() {
  solvingSimple.value = true
  error.value = null
  try {
    simpleResult.value = await solveSimpleDemo()
  } catch (e: any) {
    error.value = e.message
  } finally {
    solvingSimple.value = false
  }
}

async function runTimetableDemo() {
  solvingTimetable.value = true
  error.value = null
  try {
    // Demo-Daten: 6 Blöcke, 3 Räume, 6 Halb-Tage, 4 Dozenten
    const demoSlots = [
      { date: '2028-02-03', weekday: 'thursday' as const, period: 'morning' as const },
      { date: '2028-02-03', weekday: 'thursday' as const, period: 'afternoon' as const },
      { date: '2028-02-04', weekday: 'friday' as const, period: 'morning' as const },
      { date: '2028-02-04', weekday: 'friday' as const, period: 'afternoon' as const },
      { date: '2028-02-05', weekday: 'saturday' as const, period: 'morning' as const },
      { date: '2028-02-05', weekday: 'saturday' as const, period: 'afternoon' as const },
    ]
    const demoRooms = (rooms.value.length ? rooms.value : [
      { _id: 'room-001', name: 'Seminarraum 2.14', capacity: { seats: 30 } },
      { _id: 'room-002', name: 'Hörsaal A', capacity: { seats: 80 } },
      { _id: 'room-003', name: 'Computerlab', capacity: { seats: 24 } },
    ] as any).slice(0, 3)
    const demoBlocks = [
      { _id: 'block-A', module_id: 'mod-001', instructor_ids: ['instr-001'], slots: [demoSlots[0]] },
      { _id: 'block-B', module_id: 'mod-002', instructor_ids: ['instr-001'], slots: [demoSlots[0]] },
      { _id: 'block-C', module_id: 'mod-003', instructor_ids: ['instr-002'], slots: [demoSlots[1]] },
      { _id: 'block-D', module_id: 'mod-004', instructor_ids: ['instr-003'], slots: [demoSlots[2]] },
      { _id: 'block-E', module_id: 'mod-005', instructor_ids: ['instr-004'], slots: [demoSlots[2]] },
      { _id: 'block-F', module_id: 'mod-006', instructor_ids: ['instr-002'], slots: [demoSlots[3]] },
    ] as any
    const demoInstructors = [
      { _id: 'instr-001', name: 'Anna Weber' },
      { _id: 'instr-002', name: 'Heinz Meili' },
      { _id: 'instr-003', name: 'Nikola Widmer' },
      { _id: 'instr-004', name: 'Admir Erni' },
    ] as any
    const availability = [
      { instructor_id: 'instr-001', unavailable_half_days: [{ date: '2028-02-04', weekday: 'friday', period: 'morning' }] },
    ] as any
    const mods = new Map([
      ['mod-001', { _id: 'mod-001', title: 'Digital Marketing', expected_students: 25, scheduling_constraint: {} } as any],
      ['mod-002', { _id: 'mod-002', title: 'Change Management', expected_students: 20, scheduling_constraint: { must_not_overlap_with_module_ids: ['mod-001'] } } as any],
    ])
    timetableResult.value = await solveTimetable(demoBlocks, demoRooms, demoSlots, demoInstructors, availability, mods)
  } catch (e: any) {
    error.value = e.message
  } finally {
    solvingTimetable.value = false
  }
}

onMounted(() => {
  store.fetchSemesters()
  store.fetchLecturers()
  // Räume für Raum-Namen im Demo
  store.fetchRooms()
})
</script>