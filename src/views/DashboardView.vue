<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <h1>Dashboard</h1>
        <p class="text-body-1 mt-2">
          Welcome to CourseWeaver — curriculum mapping, scheduling, and analysis.
        </p>
      </v-col>
    </v-row>
    <v-row>
      <v-col v-for="card in dashboardCards" :key="card.to" cols="12" sm="6" md="4" lg="3">
        <v-card :to="card.to" hover>
          <v-card-item>
            <v-card-title>
              <v-icon start>{{ card.icon }}</v-icon>
              {{ card.title }}
            </v-card-title>
            <v-card-subtitle>{{ card.subtitle }}</v-card-subtitle>
          </v-card-item>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
const dashboardCards = [
  { title: 'Curriculum', subtitle: 'Programs, modules, and lessons', icon: 'mdi-book-education', to: '/curriculum' },
  { title: 'Taxonomy', subtitle: 'Competencies, levels, and proofs', icon: 'mdi-sitemap', to: '/taxonomy' },
  { title: 'Scheduling & Constraints', subtitle: 'Semester scheduling', icon: 'mdi-calendar-clock', to: '/schedule' },
  { title: 'Rooms & Locations', subtitle: 'Room and location management', icon: 'mdi-door-open', to: '/rooms' },
  { title: 'Availability', subtitle: 'Lecturer and room availability', icon: 'mdi-calendar-check', to: '/availability' },
  { title: 'Conflicts', subtitle: 'Conflict detection and resolution', icon: 'mdi-alert-circle', to: '/conflicts' },
  { title: 'Reports', subtitle: 'Export and reporting', icon: 'mdi-file-chart', to: '/reports' },
]
</script>