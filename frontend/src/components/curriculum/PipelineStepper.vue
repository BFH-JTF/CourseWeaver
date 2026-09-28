<template>
  <div class="stepper d-flex align-center flex-wrap">
    <div v-for="(step, idx) in steps" :key="step.key" class="d-flex align-center">
      <div
        class="step"
        :class="[stepClass(step), { clickable: props.clickableSteps?.includes(step.key) }]"
        :title="props.clickableSteps?.includes(step.key) ? step.hint : undefined"
        @click="onStepClick(step)"
      >
        <span class="step-num" :class="{ check: (props.states[step.key] === 'done') }">
          <v-icon v-if="props.states[step.key] === 'done'" size="x-small">{{ 'mdi-check' }}</v-icon>
          <template v-else>{{ idx + 1 }}</template>
        </span>
        {{ step.label }}
      </div>
      <v-icon v-if="idx < steps.length - 1" class="arrow">mdi-arrow-right</v-icon>
    </div>
  </div>
</template>

<script setup lang="ts">
export type StepKey = 'import' | 'build' | 'confirm' | 'assess' | 'explain'
export type StepState = 'idle' | 'active' | 'done' | 'warn'

const props = defineProps<{
  states: Record<StepKey, StepState>
  /** klickbare Schritte — z. B. 'build' = "Kandidaten bauen" einzeln ausführen */
  clickableSteps?: StepKey[]
}>()

const emit = defineEmits<{
  (e: 'step-click', key: StepKey): void
}>()

const steps: Array<{ key: StepKey; label: string; icon: string; hint?: string }> = [
  { key: 'import', label: 'Import', icon: 'mdi-tray-arrow-down' },
  {
    key: 'build',
    label: 'Kandidaten bauen',
    icon: 'mdi-filter',
    hint: 'Kandidatenpaare per Embedding-Filter finden (schnell, keine LLM-Aufrufe)',
  },
  {
    key: 'confirm',
    label: 'Kandidaten prüfen',
    icon: 'mdi-playlist-check',
    hint: 'Auswahl bestätigen, bevor teure LLM-Aufrufe starten',
  },
  { key: 'assess', label: 'LLM-Bewertung', icon: 'mdi-robot' },
  { key: 'explain', label: 'Review', icon: 'mdi-clipboard-check' },
]

function stepClass(step: { key: StepKey }): string {
  const s = props.states[step.key] ?? 'idle'
  switch (s) {
    case 'active': return 'active coral'
    case 'done': return 'done'
    case 'warn': return 'warn'
    default: return 'idle'
  }
}

function onStepClick(step: { key: StepKey }): void {
  if (!props.clickableSteps?.includes(step.key)) return
  emit('step-click', step.key)
}
</script>

<style scoped>
.step {
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 500;
  border: 1px solid var(--cw-border, #e3dfd3);
  color: var(--cw-text2, #63665f);
}
.step.clickable {
  cursor: pointer;
  user-select: none;
}
.step.clickable:hover {
  border-color: var(--cw-coral, #c6603f);
  color: var(--cw-coral, #c6603f);
}
.step.active {
  border-color: var(--cw-coral, #c6603f);
  color: var(--cw-coral, #c6603f);
  background: rgba(198, 96, 63, 0.08);
}
.step.done {
  border-color: var(--cw-accent, #2b6e63);
  color: var(--cw-accent, #2b6e63);
}
.step.warn {
  border-color: #b07c1f;
  color: #b07c1f;
  background: rgba(176, 124, 31, 0.08);
}
.arrow {
  margin: 0 6px;
  color: var(--cw-text2, #63665f);
  /* Vuetify icon klass; simple fallback via material icon text */
  font-size: 18px;
}
</style>

<style scoped>
.stepper-circ, .step-num {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  border: 1px solid var(--cw-border, #e3dfd3);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  margin-right: 6px;
  color: var(--cw-text2, #63665f);
}
.step-num.check {
  background: var(--cw-accent, #2b6e63);
  border-color: var(--cw-accent, #2b6e63);
  color: #fff;
}
.step.active {
  border-color: var(--cw-coral, #c6603f);
}
</style>
