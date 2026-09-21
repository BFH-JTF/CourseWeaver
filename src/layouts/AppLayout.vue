<template>
  <v-app>
    <v-app-bar color="primary" prominent>
      <v-app-bar-nav-icon @click="drawer = !drawer" />
      <v-app-bar-title>CourseWeaver</v-app-bar-title>
      <v-spacer />
      
      <!-- Logged-in User Display -->
      <div v-if="auth.isAuthenticated" class="d-flex align-center me-2">
        <v-chip
          variant="flat"
          color="rgba(255, 255, 255, 0.18)"
          class="text-white font-weight-medium px-3"
        >
          <v-icon start size="18">{{ auth.isAdmin ? 'mdi-shield-crown' : 'mdi-account-circle' }}</v-icon>
          <span class="text-truncate" style="max-width: 180px;">{{ localUserName }}</span>
          <v-tooltip activator="parent" location="bottom">
            Logged in as {{ localUserName }} ({{ auth.isAdmin ? 'Administrator' : 'User' }})
          </v-tooltip>
        </v-chip>
      </div>

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
          v-if="auth.isAuthenticated"
          :prepend-icon="auth.isAdmin ? 'mdi-shield-crown' : 'mdi-account-circle'"
          :title="localUserName"
          :subtitle="auth.isAdmin ? 'Administrator' : 'User'"
          class="mb-2"
        />
        <v-divider v-if="auth.isAuthenticated" class="mb-2" />
        <v-list-item
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          :prepend-icon="item.icon"
          :title="item.title"
        />
      </v-list>
    </v-navigation-drawer>

    <v-main>
      <router-view />
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

const drawer = ref(false)
const auth = useAuthStore()
const router = useRouter()

const localUserName = computed(() => auth.localUser?.name || auth.userName || 'User')

const navItems = computed(() => {
  const items = [
    { title: 'Dashboard', icon: 'mdi-view-dashboard', to: '/' },
    { title: 'Curriculum', icon: 'mdi-book-education', to: '/curriculum' },
    { title: 'Taxonomy', icon: 'mdi-sitemap', to: '/taxonomy' },
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

function closeDrawerAfterNavigation() {
  drawer.value = false
}

onMounted(() => {
  router.afterEach(closeDrawerAfterNavigation)
})

onUnmounted(() => {
  router.afterEach(() => {})
})

async function handleLogout() {
  await auth.logout()
  if (!auth.isAuthenticated) {
    router.push({ name: 'login' })
  }
}
</script>