import { createRouter, createWebHistory } from 'vue-router'
import { useDocPouch } from '@/composables/useDocPouch'
import { useAuthStore } from '@/stores/auth'

const AppLayout = () => import('@/layouts/AppLayout.vue')

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { requiresAuth: false, requiresConfig: false },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
      meta: { requiresAuth: false, requiresConfig: false },
    },
    {
      path: '/callback',
      name: 'callback',
      component: () => import('@/views/CallbackView.vue'),
      meta: { requiresAuth: false, requiresConfig: false },
    },
    {
      path: '/',
      component: AppLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'dashboard',
          component: () => import('@/views/DashboardView.vue'),
        },
        {
          path: 'curriculum',
          name: 'curriculum',
          component: () => import('@/views/CurriculumView.vue'),
        },
        {
          path: 'taxonomy',
          name: 'taxonomy',
          component: () => import('@/views/TaxonomyView.vue'),
        },
        {
          path: 'modules',
          name: 'modules',
          component: () => import('@/views/ModulesView.vue'),
        },
        {
          path: 'schedule',
          name: 'schedule',
          component: () => import('@/views/ScheduleView.vue'),
        },
        {
          path: 'rooms',
          name: 'rooms',
          component: () => import('@/views/RoomsView.vue'),
        },
        {
          path: 'conflicts',
          name: 'conflicts',
          component: () => import('@/views/ConflictsView.vue'),
        },
        {
          path: 'reports',
          name: 'reports',
          component: () => import('@/views/ReportsView.vue'),
        },
        {
          path: 'admin',
          name: 'admin',
          component: () => import('@/views/AdminView.vue'),
          meta: { requiresAdmin: true },
        },
      ],
    },
  ],
})

router.beforeEach((to) => {
  const docPouch = useDocPouch()
  const auth = useAuthStore()

  if (to.meta.requiresConfig !== false && !docPouch.isConfigured) {
    return { name: 'settings' }
  }

  if (to.meta.requiresAuth !== false && !auth.isAuthenticated) {
    return { name: 'login' }
  }

  if (to.meta.requiresAdmin && !auth.isAdmin) {
    return { name: 'dashboard' }
  }
})

export default router