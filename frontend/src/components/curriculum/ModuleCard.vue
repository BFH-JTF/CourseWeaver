<template>
  <v-card variant="outlined" class="module-card pa-2 mb-2">
    <div
      class="module-head d-flex align-center ga-2"
      role="button" tabindex="0"
      @click="$emit('toggle')"
      @keydown.enter.prevent="$emit('toggle')"
    >
      <span class="module-name text-body-2 font-weight-medium">{{ moduleEntry.name }}</span>
      <v-chip v-if="moduleEntry.credits" size="x-small" color="primary" variant="tonal">
        {{ moduleEntry.credits }} ECTS
      </v-chip>
      <v-spacer />
      <span class="text-caption text-medium-emphasis">
        {{ moduleEntry.learningCycles.length }} Learning Cycles
      </span>
      <v-icon size="small">{{ expanded ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
    </div>

    <div v-if="expanded" class="mt-1">
      <slot
        v-for="lc in visibleCyclesInternal"
        :key="lc.id"
        :cycle="lc"
      />
      <v-btn
        v-if="hiddenCount > 0 && !showAllCycles"
        size="small"
        variant="text"
        class="more-cycles"
        @click="showAllCycles = true"
      >
        + {{ hiddenCount }} weitere Learning Cycles
      </v-btn>
    </div>
  </v-card>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { LearningCycleEntry } from './types'

const props = defineProps<{
  moduleEntry: {
    id: string
    name: string
    credits?: number
    learningCycles: LearningCycleEntry[]
  }
  expanded: boolean
}>()

defineEmits<{
  toggle: []
}>()

/** Screenshot-Verhalten: 3 Zeilen direkt sichtbar, "+6 weitere Learning Cycles" öffnet den Rest */
const VISIBLE_BY_DEFAULT = 3
const showAllCycles = ref(false)

const visibleCyclesInternal = computed(() => {
  const all = props.moduleEntry.learningCycles ?? []
  return showAllCycles.value ? all : all.slice(0, VISIBLE_BY_DEFAULT)
})

const hiddenCount = computed(() =>
  Math.max(0, (props.moduleEntry.learningCycles?.length ?? 0) - VISIBLE_BY_DEFAULT),
)

watch(() => props.expanded, () => {
  showAllCycles.value = false
})
</script>

<style scoped>
.module-card {
  border-radius: 10px;
  background: var(--cw-panel, #fff);
  border: 1px solid var(--cw-border, #e3dfd3);
  border-color: var(--cw-border, #e3dfd3);
}
.module-head {
  cursor: pointer;
}
.module-name {
  color: var(--cw-text, #1e211d);
}
</style>
