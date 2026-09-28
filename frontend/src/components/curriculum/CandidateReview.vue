<template>
  <div class="candidate-review">
    <!-- Header (Screenshot 2: "Kandidaten prüfen" + Untertitel) -->
    <div class="mb-4">
      <h1 class="review-title mb-1">Kandidaten prüfen</h1>
      <div class="text-body-2 text-medium-emphasis">
        Vor der LLM-Bewertung: welche Paare tatsächlich geprüft werden sollen
      </div>
    </div>

    <!-- Lexikalischer Modus: Warnung ("schwach besetzte Themenfelder", Kap. 2.1) -->
    <v-alert v-if="lexicalMode" type="warning" variant="tonal" density="compact" class="mb-4">
      Diese Kandidaten wurden im <strong>lexikalischen Modus</strong> gefunden — kein Embedding-Server
      konfiguriert. Ein lexikalisches Modell erkennt deutlich weniger Übereinstimmungen als ein
      Embedding-Modell; die Trefferliste ist wahrscheinlich zu kurz (Kap. 2.1, schwach besetzte
      Themenfelder).
    </v-alert>

    <!-- Auswahl-Zähler (Screenshot: "4 VON 4 AUSGEWÄHLT" / "Alle abwählen") -->
    <div class="d-flex align-center justify-space-between mb-2 flex-wrap ga-2">
      <div class="text-subtitle-2 text-uppercase" style="letter-spacing: 0.08em;">
        {{ selectedCount }} von {{ candidates.length }} ausgewählt
      </div>
      <v-btn variant="text" size="small" color="accent" @click="toggleAll">
        {{ allSelected ? 'Alle abwählen' : 'Alle auswählen' }}
      </v-btn>
    </div>

    <!-- Paar-Liste -->
    <v-card variant="outlined" class="pa-2 mb-2" style="background: transparent; border-color: var(--cw-border, #e3dfd3);">
      <div
        v-for="entry in candidates"
        :key="entry.key"
        class="pair-row"
        :class="{ selected: entry.selected }"
        role="checkbox"
        :aria-checked="entry.selected"
        tabindex="0"
        @click="entry.selected = !entry.selected"
        @keydown.space.prevent="entry.selected = !entry.selected"
      >
        <!-- Learning Cycle A -->
        <div class="d-flex align-center flex-grow-1" style="min-width: 0;">
          <div class="lc-avatar" :style="{ background: avatarColor(entry.aName) }">
            {{ initials(entry.aName) }}
          </div>
          <div class="ml-3" style="min-width: 0;">
            <div class="text-body-2 font-weight-bold text-truncate">{{ entry.aName }}</div>
            <div class="text-body-2 font-weight-medium text-truncate">{{ entry.aTitle }}</div>
            <div class="text-caption text-medium-emphasis text-truncate">{{ entry.aSummary }}</div>
          </div>
        </div>

        <v-icon class="mx-2 flex-shrink-0" size="small">mdi-swap-horizontal</v-icon>

        <!-- Learning Cycle B -->
        <div class="d-flex align-center flex-grow-1" style="min-width: 0;">
          <div class="lc-avatar" :style="{ background: avatarColor(entry.bName) }">
            {{ initials(entry.bName) }}
          </div>
          <div class="ml-3" style="min-width: 0;">
            <div class="text-body-2 font-weight-bold text-truncate">{{ entry.bName }}</div>
            <div class="text-body-2 font-weight-medium text-truncate">{{ entry.bTitle }}</div>
            <div class="text-caption text-medium-emphasis text-truncate">{{ entry.bSummary }}</div>
          </div>
        </div>

        <!-- Ähnlichkeits-Chip -->
        <div class="ml-2 flex-shrink-0">
          <span class="sim-chip">{{ chipLabel(entry) }}</span>
        </div>

        <!-- Auswahl-Checkbox -->
        <div class="ml-4 flex-shrink-0">
          <input
            type="checkbox"
            class="pair-checkbox"
            :checked="entry.selected"
            @click.stop="entry.selected = !entry.selected"
          >
        </div>
      </div>

      <!-- "+ Paar manuell hinzufügen" + Werkbank-Toggle (Werkbank = Ergänzung im Schritt, nicht eigene Seite) -->
      <div class="manual-add" @click="manualOpen = true">
        <v-icon size="small">mdi-plus</v-icon>
        <span class="ml-1">Paar manuell hinzufügen</span>
      </div>
      <div class="werkbank-toggle" @click="werkbankOpen = !werkbankOpen">
        <v-icon size="small">{{ werkbankOpen ? 'mdi-close' : 'mdi-drag' }}</v-icon>
        <span class="ml-1">{{ werkbankOpen ? 'Werkbank schliessen' : 'Kandidaten-Werkbank: Paar per Drag & Drop bauen' }}</span>
      </div>
    </v-card>

    <!-- ============ Kandidaten-Werkbank (Drag & Drop per vuedraggable) ============
         Identische Zustandslogik wie die Klick-Simulation im Mockup-Artboard:
         Links LC-Baum (pull:'clone' → Quelle bleibt stehen), rechts Zwei-Slot-
         Ablage + fertige Paare. Gebaute Paare landen in derselben Liste wie
         "Paar manuell hinzufügen" (OverlapCandidate-Typ, kein zweiter Weg). -->
    <v-card v-if="werkbankOpen" variant="outlined" class="pa-4 mb-2 werkbank">
      <div class="text-subtitle-2 font-weight-bold mb-2">Kandidaten-Werkbank</div>
      <div class="text-caption text-medium-emphasis mb-3">
        Learning Cycle anklicken und auf einen Ablageplatz ziehen (klicken = aufheben,
        nochmal klicken auf freien Platz = ablegen). Quelle bleibt stehen (clone).
      </div>

      <div class="werkbank-grid">
        <!-- Links: Baum aller Learning Cycles (nach Modul gruppiert) -->
        <div class="werkbank-tree">
          <div v-for="group in cycleGroups" :key="group.moduleName" class="mb-3">
            <div class="text-caption font-weight-bold text-medium-emphasis mb-1">{{ group.moduleName }}</div>
            <draggable
              :list="group.cycles"
              class="d-flex flex-wrap"
              :group="{ name: 'cycles', pull: 'clone', put: false }"
              :sort="false"
              item-key="id"
              @change="noopChange"
            >
              <template #item="{ element }">
                <div
                  class="lc-chip"
                  :class="{ picked: pickedId === element.id, placed: isPlaced(element.id) }"
                  @click="pickFromTree(element)"
                >
                  {{ element.label }}
                </div>
              </template>
            </draggable>
          </div>
        </div>

        <!-- Rechts: Zwei-Slot-Ablage + fertige Paare -->
        <div class="werkbank-right">
          <div class="mb-2">
            <div class="text-caption text-medium-emphasis mb-1">Ablageplatz für Seiten A</div>
            <draggable
              v-model="slotA"
              class="drop-slot"
              :class="{ filled: slotA.length > 0 }"
              :group="{ name: 'cycles', pull: false, put: true }"
              :sort="false"
              item-key="id"
              @change="onSlotChange()"
              @click="onSlotClick('A')"
            >
              <template #item="{ element }">
                <div class="lc-chip placed" @click.stop="clearSlot('A')">{{ element.label }}</div>
              </template>
              <template #header>
                <div v-if="slotA.length === 0" class="slot-empty-hint">LC hierhin ziehen oder klicken …</div>
              </template>
            </draggable>
          </div>
          <div class="mb-3">
            <div class="text-caption text-medium-emphasis mb-1">Ablageplatz für Seite B</div>
            <draggable
              v-model="slotB"
              class="drop-slot"
              :class="{ filled: slotB.length > 0 }"
              :group="{ name: 'cycles', pull: false, put: true }"
              :sort="false"
              item-key="id"
              @change="onSlotChange()"
              @click="onSlotClick('B')"
            >
              <template #item="{ element }">
                <div class="lc-chip placed" @click.stop="clearSlot('B')">{{ element.label }}</div>
              </template>
              <template #header>
                <div v-if="slotB.length === 0" class="slot-empty-hint">LC hierhin ziehen oder klicken …</div>
              </template>
            </draggable>
          </div>

          <v-alert v-if="werkbankWarn" type="warning" variant="tonal" density="compact" class="mb-2">
            {{ werkbankWarn }}
          </v-alert>
          <v-btn
            color="coral"
            variant="flat"
            size="small"
            prepend-icon="mdi-content-save"
            :disabled="!canCompletePair"
            @click="completePair"
          >
            Paar übernehmen
          </v-btn>

          <div class="mt-4">
            <div class="text-caption font-weight-bold text-medium-emphasis mb-1">
              Fertige Paare ({{ candidates.length }})
            </div>
            <div v-for="entry in candidates" :key="entry.key" class="finished-pair-row">
              <span class="text-body-2">{{ entry.aName }} · {{ entry.aTitle }}</span>
              <v-icon size="x-small" class="mx-1">mdi-swap-horizontal</v-icon>
              <span class="text-body-2">{{ entry.bName }} · {{ entry.bTitle }}</span>
              <span class="sim-chip ms-2">{{ chipLabel(entry) }}</span>
              <v-btn
                icon="mdi-close"
                size="x-small"
                variant="text"
                color="medium-emphasis"
                title="Paar entfernen"
                @click="$emit('remove-pair', entry.key)"
              />
            </div>
            <div v-if="candidates.length === 0" class="text-caption text-medium-emphasis">
              Noch keine Paare gebaut.
            </div>
          </div>
        </div>
      </div>
    </v-card>

    <!-- Manuell-Paar-Dialog -->
    <v-dialog v-model="manualOpen" max-width="560">
      <v-card variant="flat" class="pa-4">
        <div class="text-subtitle-1 font-weight-bold mb-1">Paar manuell hinzufügen</div>
        <div class="text-caption text-medium-emphasis mb-3">
          Zwei Learning Cycles wählen — das Paar wird der LLM-Bewertung zusätzlich übergeben.
        </div>
        <v-select
          v-model="manualAId"
          :items="cycleGroupedItems"
          item-title="label"
          item-value="id"
          label="Learning Cycle A"
          variant="outlined"
          density="compact"
        ></v-select>
        <v-select
          v-model="manualBId"
          :items="cycleBItems"
          item-title="label"
          item-value="id"
          label="Learning Cycle B"
          variant="outlined"
          density="compact"
        ></v-select>
        <div class="d-flex justify-end ga-2 mt-2">
          <v-btn variant="text" @click="manualOpen = false">Abbrechen</v-btn>
          <v-btn color="coral" variant="flat" :disabled="!canAddManual" @click="addManualPair">
            Hinzufügen
          </v-btn>
        </div>
      </v-card>
    </v-dialog>

    <!-- Footer (Screenshot): Abbrechen / weiter zur LLM-Bewertung.
         Kap. 2.1-Pipeline: der Start der teuren Bewertung passiert von der
         Step-4-Ansicht aus, deshalb bmieter diese Ansicht nur die Auswahl —
         sie bleibt bei cancelAn alternative offen. -->
    <div class="d-flex align-center justify-end ga-3 mt-4">
      <v-btn variant="text" @click="$emit('cancel')">Abbrechen</v-btn>
      <v-btn
        color="coral"
        class="llm-button"
        prepend-icon="mdi-arrow-right"
        :disabled="selectedCount === 0"
        @click="$emit('continue')"
      >
        Weiter zu "LLM-Bewertung" ({{ selectedCount }} Paare)
      </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import draggable from 'vuedraggable'

export interface CandidatePairEntry {
  key: string
  aId: string
  bId: string
  aName: string
  bName: string
  aTitle: string
  bTitle: string
  aSummary: string
  bSummary: string
  /** 0-1 Embedding/Jaccard-Ähnlichkeit; null bei manuellen Paaren */
  similarity: number | null
  manual: boolean
  selected: boolean
}

interface CycleItem {
  id: string
  label: string
  moduleName: string
}

const props = defineProps<{
  candidates: CandidatePairEntry[]
  lexicalMode: boolean
  /** aller LCs des Programms für die manuelle Paarwahl, gruppiert nach Modul */
  cycles: CycleItem[]
}>()

const emit = defineEmits<{
  (e: 'cancel'): void
  /* Auswahl bestätigt → weiter zur "LLM-Bewertung"-Ansicht (Start dort, Kap. 2.1) */
  (e: 'continue'): void
  /* Parent ergänzt das Paar (mit Anzeige "manuell") — DASSELBE Dattenmodell wie im Dialog */
  (e: 'add-manual', pair: { cycleAId: string; cycleBId: string }): void
  /* Parent entfernt das Paar (Werkbank-Liste) */
  (e: 'remove-pair', pairKey: string): void
}>()

/* ============================ Kandidaten-Werkbank ============================ */
/* Drag & Drop via vuedraggable (Kap-Spec: weniger fehleranfällig als native
   HTML5-DnD-API, funktioniert auch auf Touch). Zustandslogik identisch zur
   Klick-Simulation im Mockup: klicken= aufheben, klick auf_slotsort= ablegen. */

const selectedCount = computed(() => props.candidates.filter(c => c.selected).length)
const allSelected = computed(() => props.candidates.length > 0 && props.candidates.every(c => c.selected))

function toggleAll(): void {
  const target = !allSelected.value
  props.candidates.forEach(c => { c.selected = target })
}

function chipLabel(entry: CandidatePairEntry): string {
  if (entry.manual) return 'manuell'
  return `${Math.round((entry.similarity ?? 0) * 100)}% ähnlich`
}

/* --- Manuelle Paar-Ergänzung ---------------------------------------- */

const manualOpen = ref(false)
const manualAId = ref<string | null>(null)
const manualBId = ref<string | null>(null)

const cycleGroupedItems = computed(() =>
  props.cycles.map(c => ({ title: `${c.moduleName} — ${c.label}`, value: c.id })),
)
const cycleBItems = computed(() =>
  cycleGroupedItems.value.filter(i => i.value !== manualAId.value),
)

const canAddManual = computed(() =>
  Boolean(manualAId.value && manualBId.value && manualAId.value !== manualBId.value),
)

function addManualPair(): void {
  const aId = manualAId.value
  const bId = manualBId.value
  if (!aId || !bId || aId === bId) return
  emit('add-manual', { cycleAId: aId, cycleBId: bId })
  manualAId.value = null
  manualBId.value = null
  manualOpen.value = false
}

/* --- Werkbank-Zustandslogik (identisch zur Klick-Simulation im Mockup) --- */

const werkbankOpen = ref(false)
const pickedId = ref<string | null>(null)
const slotA = ref<CycleItem[]>([])
const slotB = ref<CycleItem[]>([])
const werkbankWarn = ref('')

const cycleGroups = computed(() => {
  const map = new Map<string, CycleItem[]>()
  for (const c of props.cycles) {
    const list = map.get(c.moduleName) ?? []
    list.push(c)
    map.set(c.moduleName, list)
  }
  return [...map.entries()].map(([moduleName, cycles]) => ({ moduleName, cycles }))
})

function isPlaced(id: string): boolean {
  return slotA.value.some(c => c.id === id) || slotB.value.some(c => c.id === id)
}

/** Klick im Baum: Aufheben-Logik des DnD (klick = aufheben → ablageplatz wählen) */
function pickFromTree(item: CycleItem): void {
  if (isPlaced(item.id)) return
  pickedId.value = pickedId.value === item.id ? null : item.id
}

/** Klick-Simulation (wie Mockup): aufgehobener LC + Klick auf Ablageplatz = ablegen */
function onSlotClick(slot: 'A' | 'B'): void {
  if (!pickedId.value) return
  if (isPlaced(pickedId.value)) {
    pickedId.value = null
    return
  }
  const item = props.cycles.find(c => c.id === pickedId.value)
  if (!item) return
  const target = slot === 'A' ? slotA : slotB
  const other = slot === 'A' ? slotB : slotA
  target.value = [item]
  if (other.value.length === 1 && other.value[0]!.id === item.id) other.value = []
  pickedId.value = null
  onSlotChange()
}

function clearSlot(slot: 'A' | 'B'): void {
  ;(slot === 'A' ? slotA : slotB).value = []
  pickedId.value = null
}

function onSlotChange(): void {
  // Maximal 1 LC pro Ablageplatz; derselbe LC nur auf EINEM Platz
  for (const slotRef of [slotA, slotB]) {
    while (slotRef.value.length > 1) slotRef.value.splice(1)
  }
  const a = slotA.value[0]?.id
  const b = slotB.value[0]?.id
  if (a && b && a === b) {
    slotB.value = []
    werkbankWarn.value = 'Derselbe Learning Cycle kann nicht beide Seiten eines Paars sein.'
  } else {
    werkbankWarn.value = ''
  }
}

const canCompletePair = computed(() =>
  slotA.value.length === 1 && slotB.value.length === 1 && slotA.value[0]!.id !== slotB.value[0]!.id,
)

/** Paar übernehmen: derselbe OverlapCandidate-Weg wie "Paar manuell hinzufügen" */
function completePair(): void {
  if (!canCompletePair.value) return
  emit('add-manual', { cycleAId: slotA.value[0]!.id, cycleBId: slotB.value[0]!.id })
  slotA.value = []
  slotB.value = []
  pickedId.value = null
}

function noopChange(): void {
  /* Quelle mit pull:'clone' — nichts zu tun, Liste bleibt unverändert */
}

/* --- Anzeige-Helfer --------------------------------------------------- */

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const letters = words.slice(0, 2).map(w => w.charAt(0).toUpperCase())
  return letters.join('') || '?'
}

function avatarColor(name: string): string {
  const palette = ['#c96f4a', '#2b6e63', '#517b8c', '#8c7351', '#7a6b95', '#4d8a6a', '#9c5f61']
  let h = 7
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 997
  return palette[h % palette.length]!
}
</script>

<style scoped>
.review-title {
  font-family: 'Fraunces', serif;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--cw-text, #1e211d);
}

.pair-row {
  display: flex;
  align-items: center;
  padding: 10px 8px;
  border-radius: 10px;
  cursor: pointer;
  border: 1px solid transparent;
}
.pair-row:hover {
  background: rgba(0, 0, 0, 0.02);
}
.pair-row.selected {
  background: rgba(43, 110, 99, 0.06);
}

.lc-avatar {
  width: 34px;
  height: 34px;
  min-width: 34px;
  border-radius: 50%;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sim-chip {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(43, 110, 99, 0.12);
  color: #2b6e63;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.pair-checkbox {
  width: 18px;
  height: 18px;
  accent-color: #2b6e63;
  cursor: pointer;
}

.manual-add {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-top: 8px;
  padding: 10px;
  border: 1px dashed var(--cw-border, #d8d2c2);
  border-radius: 10px;
  color: var(--cw-text2, #63665f);
  font-size: 13px;
  cursor: pointer;
  background: transparent;
}
.manual-add:hover {
  border-color: var(--cw-coral, #c6603f);
  color: var(--cw-coral, #c6603f);
}

.werkbank-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-top: 6px;
  padding: 9px;
  border: 1px dashed var(--cw-border, #d8d2c2);
  border-radius: 10px;
  color: var(--cw-text2, #63665f);
  font-size: 13px;
  cursor: pointer;
  background: transparent;
}
.werkbank-toggle:hover {
  border-color: var(--cw-accent, #2b6e63);
  color: var(--cw-accent, #2b6e63);
}

.werkbank {
  border-color: var(--cw-border, #e3dfd3) !important;
  background: rgba(43, 110, 99, 0.03) !important;
}
.werkbank-grid {
  display: flex;
  gap: 18px;
  align-items: flex-start;
}
@media (max-width: 900px) {
  .werkbank-grid { flex-direction: column; }
}
.werkbank-tree {
  flex: 1 1 55%;
  min-width: 0;
}
.werkbank-right {
  flex: 1 1 320px;
  min-width: 300px;
}
.lc-chip {
  display: inline-block;
  padding: 5px 10px;
  border-radius: 8px;
  border: 1px solid var(--cw-border, #e3dfd3);
  background: #fff;
  font-size: 12px;
  cursor: grab;
  user-select: none;
  margin: 0 6px 6px 0;
}
.lc-chip.picked {
  border-color: var(--cw-coral, #c6603f);
  color: var(--cw-coral, #c6603f);
  background: rgba(198, 96, 63, 0.08);
}
.lc-chip.placed {
  border-color: var(--cw-accent, #2b6e63);
  color: var(--cw-accent, #2b6e63);
  background: rgba(43, 110, 99, 0.08);
}
.drop-slot {
  min-height: 46px;
  border: 1px dashed var(--cw-border, #d8d2c2);
  border-radius: 10px;
  padding: 5px;
  background: rgba(0, 0, 0, 0.02);
}
.drop-slot.filled {
  border-color: var(--cw-accent, #2b6e63);
  background: rgba(43, 110, 99, 0.05);
}
.slot-empty-hint {
  font-size: 12px;
  color: var(--cw-text2, #9a9d95);
  padding: 4px 6px;
}
.finished-pair-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 0;
  border-bottom: 1px solid var(--cw-border, #eee8da);
}
.finished-pair-row:last-child {
  border-bottom: none;
}
.finished-pair-row .text-body-2 {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
</style>
