<template>
  <router-view />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useOidc } from '@/composables/useOidc'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const oidc = useOidc()
const auth = useAuthStore()

onMounted(async () => {
  if (oidc.hasOidcCallbackParams()) {
    try {
      const handled = await oidc.handleOidcCallback()
      if (handled) {
        await auth.initAuth()
        window.history.replaceState({}, '', window.location.pathname)
        router.replace({ name: 'dashboard' })
        return
      }
    } catch (e) {
      console.error('OIDC callback handling failed:', e)
    }
  }

  const authenticated = await auth.initAuth()
  if (authenticated) {
    const currentRoute = router.currentRoute.value
    if (currentRoute.name === 'login' || currentRoute.name === 'callback') {
      router.replace({ name: 'dashboard' })
    }
  }
})
</script>
