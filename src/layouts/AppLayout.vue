<template>
  <v-app>
    <v-app-bar color="primary" prominent>
      <v-app-bar-nav-icon @click="drawer = !drawer" />
      <v-app-bar-title>CourseWeaver</v-app-bar-title>
      <v-spacer />
      <v-btn icon to="/settings" v-if="auth.isAuthenticated">
        <v-icon>mdi-cog</v-icon>
        <v-tooltip activator="parent">Settings</v-tooltip>
      </v-btn>
      <v-btn v-if="auth.isAuthenticated" icon @click="handleLogout">
        <v-icon>mdi-logout</v-icon>
        <v-tooltip activator="parent">Logout</v-tooltip>
      </v-btn>
    </v-app-bar>

    <v-navigation-drawer v-model="drawer" temporary>
      <v-list nav>
        <v-list-item
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          :prepend-icon="item.icon"
          :title="item.title"
          @click="drawer = false"
        />
      </v-list>
    </v-navigation-drawer>

    <v-main>
      <router-view />
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

const drawer = ref(false)
const auth = useAuthStore()
const router = useRouter()

const navItems = computed(() => {
  const items = [
    { title: 'Dashboard', icon: 'mdi-view-dashboard', to: '/' },
    { title: 'Curriculum', icon: 'mdi-book-education', to: '/curriculum' },
    { title: 'Taxonomy', icon: 'mdi-sitemap', to: '/taxonomy' },
    { title: 'Modules', icon: 'mdi-view-module', to: '/modules' },
    { title: 'Schedule', icon: 'mdi-calendar-clock', to: '/schedule' },
    { title: 'Rooms & Locations', icon: 'mdi-door-open', to: '/rooms' },
    { title: 'Conflicts', icon: 'mdi-alert-circle', to: '/conflicts' },
    { title: 'Reports', icon: 'mdi-file-chart', to: '/reports' },
  ]
  if (auth.isAdmin) {
    items.push({ title: 'Admin', icon: 'mdi-shield-account', to: '/admin' })
  }
  return items
})

async function handleLogout() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>