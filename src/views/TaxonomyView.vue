<template>
  <v-container>
    <h1>Taxonomy</h1>
    <p class="text-body-1 mt-2 mb-4">
      Manage competency frameworks, learning objectives, and proofs of knowledge used across the curriculum.
    </p>
    <v-row>
      <v-col cols="12" md="4">
        <v-card>
          <v-card-title>Competencies</v-card-title>
          <v-card-text>
            <v-list>
              <v-list-item
                v-for="item in competencies"
                :key="item._id"
                :title="item.name"
                :subtitle="item.description"
              />
              <v-list-item v-if="competencies.length === 0" title="No competencies defined yet" />
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="4">
        <v-card>
          <v-card-title>Learning Objectives</v-card-title>
          <v-card-text>
            <v-list>
              <v-list-item
                v-for="item in learningObjectives"
                :key="item._id"
                :title="item.name"
                :subtitle="item.description"
              />
              <v-list-item v-if="learningObjectives.length === 0" title="No learning objectives defined yet" />
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="4">
        <v-card>
          <v-card-title>Proofs of Knowledge</v-card-title>
          <v-card-text>
            <v-list>
              <v-list-item
                v-for="item in proofsOfKnowledge"
                :key="item._id"
                :title="item.name"
                :subtitle="item.description"
              />
              <v-list-item v-if="proofsOfKnowledge.length === 0" title="No proofs of knowledge defined yet" />
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useCurriculumStore } from '@/stores/curriculum'

const store = useCurriculumStore()
const { taxonomyItems } = storeToRefs(store)

const competencies = computed(() => taxonomyItems.value.filter(t => t.category === 'competency'))
const learningObjectives = computed(() => taxonomyItems.value.filter(t => t.category === 'learningObjective'))
const proofsOfKnowledge = computed(() => taxonomyItems.value.filter(t => t.category === 'proofOfKnowledge'))

onMounted(() => {
  store.fetchTaxonomyItems()
})
</script>