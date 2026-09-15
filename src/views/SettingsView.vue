<template>
  <v-container>
    <v-row justify="center">
      <v-col cols="12" sm="8" md="6">
        <v-card>
          <v-card-title>Server Settings</v-card-title>
          <v-card-text>
            <p class="text-body-2 mb-4">
              Configure the connection to your DocPouch server before logging in.
              Ask your administrator for the OIDC Registration Token if you need to register this application.
            </p>

            <v-form @submit.prevent="handleSave">
              <v-text-field
                v-model="settingsUrl"
                label="DocPouch URL"
                placeholder="https://your-docpouch-server.com"
                hint="The full URL of your DocPouch server (with or without scheme)"
                :rules="[urlRule]"
                required
              />

              <v-text-field
                v-model="settingsPort"
                label="Port"
                type="number"
                placeholder="443"
                hint="Leave 0 if the URL already includes the port"
              />

              <v-text-field
                v-model="settingsRegistrationToken"
                label="OIDC Registration Token"
                type="password"
                hint="One-time token from your DocPouch admin (OIDC_REGISTRATION_TOKEN). Leave empty to keep the existing token."
              />

              <v-alert v-if="registerError" type="error" density="compact" class="mt-2">
                {{ registerError }}
              </v-alert>

              <v-alert v-if="registerSuccess" type="success" density="compact" class="mt-2">
                Registration successful! You can now log in.
              </v-alert>

              <div class="d-flex gap-2 mt-4">
                <v-btn type="submit" color="primary" :loading="isRegistering">
                  Save &amp; Register
                </v-btn>
                <v-btn variant="outlined" @click="handleClear">
                  Clear All Data
                </v-btn>
                <v-btn variant="text" @click="goBack">
                  Cancel
                </v-btn>
              </div>
            </v-form>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDocPouch } from '@/composables/useDocPouch'

const router = useRouter()
const {
  saveSettings,
  clearSettings,
  performRegistration,
  loadSettings,
  isRegistering,
  registerError,
} = useDocPouch()

const settingsUrl = ref('')
const settingsPort = ref('0')
const settingsRegistrationToken = ref('')
const registerSuccess = ref(false)

const urlRule = (v: string) =>
  !v || /^https?:\/\//i.test(v) || /^[^\s:]+$/i.test(v) || 'Enter a valid URL'

onMounted(() => {
  const saved = loadSettings()
  settingsUrl.value = saved.url
  settingsPort.value = saved.port
  settingsRegistrationToken.value = saved.registrationToken
})

async function handleSave() {
  registerSuccess.value = false
  const portNum = parseInt(settingsPort.value) || 0
  saveSettings(settingsUrl.value, portNum, settingsRegistrationToken.value)

  if (settingsRegistrationToken.value) {
    const ok = await performRegistration(settingsRegistrationToken.value)
    if (ok) {
      registerSuccess.value = true
    }
  } else {
    registerSuccess.value = true
  }
}

function handleClear() {
  clearSettings()
  settingsUrl.value = ''
  settingsPort.value = '0'
  settingsRegistrationToken.value = ''
  registerSuccess.value = false
}

function goBack() {
  router.push({ name: 'login' })
}
</script>