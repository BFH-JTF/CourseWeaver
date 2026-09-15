<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="4" class="text-center">
        <v-progress-circular indeterminate size="64" class="mb-4" />
        <p class="text-h6">Completing login...</p>
        <v-alert v-if="error" type="error" class="mt-4">
          {{ error }}
        </v-alert>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDocPouch } from '@/composables/useDocPouch'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const docPouch = useDocPouch()
const auth = useAuthStore()
const error = ref('')

onMounted(async () => {
  if (!docPouch.client.value) {
    await docPouch.initService()
  }

  if (docPouch.client.value) {
    try {
      const handled = await docPouch.client.value.handleOidcCallback()
      if (handled) {
        await auth.initAuth()
        router.replace({ name: 'dashboard' })
      } else {
        error.value = 'OIDC callback was not handled. Please try logging in again.'
        setTimeout(() => router.replace({ name: 'login' }), 3000)
      }
    } catch (e: any) {
      error.value = e?.message || 'Authentication failed'
      setTimeout(() => router.replace({ name: 'login' }), 3000)
    }
  } else {
    error.value = 'Could not connect to DocPouch server.'
    setTimeout(() => router.replace({ name: 'settings' }), 3000)
  }
})
</script>