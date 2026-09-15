<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="4" class="text-center">
        <v-progress-circular indeterminate size="64" class="mb-4" />
        <p class="text-h6">Completing OIDC login...</p>
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
import { useOidc } from '@/composables/useOidc'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const oidc = useOidc()
const auth = useAuthStore()
const error = ref('')

onMounted(async () => {
  try {
    const handled = await oidc.handleOidcCallback()
    if (handled) {
      await auth.initAuth()
      router.replace({ name: 'dashboard' })
    } else {
      error.value = 'OIDC callback could not be completed. Please try logging in again.'
      setTimeout(() => router.replace({ name: 'login' }), 3000)
    }
  } catch (e: any) {
    error.value = e?.message || 'Authentication failed'
    setTimeout(() => router.replace({ name: 'login' }), 3000)
  }
})
</script>
