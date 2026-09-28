<template>
  <v-card variant="outlined" class="semester-section pa-3 mb-3">
    <div
      class="section-head d-flex align-center justify-space-between"
      role="button" tabindex="0"
      @click="$emit('toggle')"
      @keydown.enter.prevent="$emit('toggle')"
    >
      <span class="text-subtitle-1 font-weight-bold">Semester {{ semester }}</span>
      <span class="text-caption text-medium-emphasis me-2">{{ modules.length }} Module</span>
      <v-icon size="small">{{ expanded ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
    </div>

    <div v-if="expanded" class="mt-2">
      <ModuleCard
        v-for="m in modules"
        :key="m.id"
        :module-entry="m"
        :expanded="expandedModuleIds.includes(m.id)"
        @toggle="$emit('toggle-module', m.id)"
      >
        <template #default="{ cycle }">
          <LearningCycleRow
            :lc="cycle"
            :expanded="expandedCycleIds.includes(cycle.id)"
            @toggle-cycle="$emit('toggle-cycle', cycle.id)"
          />
        </template>
      </ModuleCard>
      <div v-if="modules.length === 0" class="text-caption text-medium-emphasis pa-2">
        Keine Module in diesem Semester erfasst.
      </div>
    </div>
  </v-card>
</template>

<script setup lang="ts">
import ModuleCard from './ModuleCard.vue'
import LearningCycleRow from './LearningCycleRow.vue'
import type { CurriculumModuleEntry } from './types'

defineProps<{
  semester: number
  expanded: boolean
  expandedModuleIds: string[]
  /** Kap Spec 2 — gruppiert nach moduleId, aus demselben LearningCycle[]-Bestand */
  modules: CurriculumModuleEntry[]
  expandedCycleIds: string[]
}>()

defineEmits<{
  toggle: []
  'toggle-module': [id: string]
  'toggle-cycle': [id: string]
}>()
</script>
