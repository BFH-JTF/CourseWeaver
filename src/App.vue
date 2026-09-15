<template>
  <router-view />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDocPouch } from '@/composables/useDocPouch'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const docPouch = useDocPouch()
const auth = useAuthStore()

onMounted(async () => {
  if (docPouch.hasOidcCallbackParams()) {
    if (!docPouch.client.value) {
      await docPouch.initService()
    }
    if (docPouch.client.value) {
      try {
        const handled = await docPouch.client.value.handleOidcCallback()
        if (handled) {
          await auth.initAuth()
          window.history.replaceState({}, '', window.location.pathname)
          router.replace({ name: 'dashboard' })
          docPouch.enableRealtimeIfConfigured()
          return
        }
      } catch (e) {
        console.error('OIDC callback handling failed:', e)
      }
    }
  }

  const authenticated = await auth.initAuth()
  if (authenticated) {
    docPouch.enableRealtimeIfConfigured()
    const currentRoute = router.currentRoute.value
    if (currentRoute.name === 'login' || currentRoute.name === 'callback') {
      router.replace({ name: 'dashboard' })
    }
  }
})
</script>