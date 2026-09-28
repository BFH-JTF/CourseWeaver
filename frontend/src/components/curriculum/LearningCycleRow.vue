<template>
  <div
    class="lc-row d-flex align-center ga-2 py-1"
    role="button" tabindex="0"
    @click="$emit('toggle-cycle')"
    @keydown.enter.prevent="$emit('toggle-cycle')"
  >
    <span v-if="lc.calendarWeek" class="lc-badge text-caption">{{ lc.calendarWeek }}</span>
        <span class="text-body-2 font-weight-medium">{{ lc.structuralElement ?? (lc.number != null ? 'Learning Cycle ' + lc.number : 'LC') }}</span>
    <span class="text-body-2">{{ lc.learningGoals || lc.mainContent || '—' }}</span>
  </div>
  <div v-if="expanded" class="lc-detail pb-2 ps-8">
    <div v-if="lc.learningGoals" class="text-caption">
      <b>Lernziele:</b> {{ lc.learningGoals }}
    </div>
    <div v-if="lc.mainContent" class="text-caption">
      <b>Inhalte:</b> {{ lc.mainContent }}
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  lc: {
    id: string
    calendarWeek?: string
    structuralElement?: string
    number?: number
    learningGoals?: string
    mainContent?: string
    level?: string
  }
  expanded: boolean
}>()

defineEmits<{ 'toggle-cycle': [] }>()
</script>
