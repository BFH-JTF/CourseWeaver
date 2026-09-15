<template>
  <v-container>
    <h1>Modules</h1>
    <p class="text-body-1 mt-2 mb-4">
      Manage modules, their details (credits, hours), and inter-module constraints (prerequisites, corequisites, exclusions).
    </p>
    <v-table>
      <thead>
        <tr>
          <th>Code</th>
          <th>Name</th>
          <th>Credits</th>
          <th>Contact hrs</th>
          <th>Self-study hrs</th>
          <th>Constraints</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="m in modules" :key="m._id">
          <td>{{ m.code }}</td>
          <td>{{ m.name }}</td>
          <td>{{ m.creditPoints }}</td>
          <td>{{ m.contactHours }}</td>
          <td>{{ m.selfStudyHours }}</td>
          <td>{{ m.constraints?.length ?? 0 }}</td>
        </tr>
        <tr v-if="modules.length === 0">
          <td colspan="6" class="text-center">No modules defined yet</td>
        </tr>
      </tbody>
    </v-table>
  </v-container>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useCurriculumStore } from '@/stores/curriculum'

const store = useCurriculumStore()
const { modules } = storeToRefs(store)

onMounted(() => {
  store.fetchModules()
})
</script>