<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="4">
        <v-card>
          <v-card-title class="text-h5 text-center">CourseWeaver</v-card-title>
          <v-card-text>
            <div v-if="!isConfigured" class="text-center mb-4">
              <v-alert type="warning" variant="tonal" class="mb-3">
                OIDC identity provider is not configured yet.
              </v-alert>
              <v-btn color="primary" to="/settings">
                Configure Settings
              </v-btn>
            </div>

            <div v-else>
              <v-alert v-if="authError" type="error" density="compact" class="mb-3">
                {{ authError }}
              </v-alert>

              <v-btn
                color="primary"
                block
                :disabled="!isConfigured"
                :loading="isLoggingIn"
                @click="handleLogin"
              >
                <v-icon start>mdi-login</v-icon>
                Log in with OIDC ({{ providerName }})
              </v-btn>

              <div class="text-center mt-3">
                <v-btn variant="text" size="small" to="/settings">
                  <v-icon start>mdi-cog</v-icon>
                  Server &amp; OIDC Settings
                </v-btn>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useOidc } from '@/composables/useOidc'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const oidc = useOidc()
const auth = useAuthStore()

const isConfigured = computed(() => oidc.isConfigured.value)
const authError = computed(() => oidc.authError.value)
const providerName = computed(() => (oidc.providerType.value === 'docpouch' ? 'docPouch' : 'EduID / OIDC'))
const isLoggingIn = ref(false)

onMounted(async () => {
  const authenticated = await auth.initAuth()
  if (authenticated) {
    router.replace({ name: 'dashboard' })
  }
})

async function handleLogin() {
  oidc.clearAuthError()
  isLoggingIn.value = true
  try {
    await oidc.loginWithOidc()
  } catch {
    // If OIDC redirect fails, the error is stored in authError
  } finally {
    isLoggingIn.value = false
  }
}
</script>
