<template>
  <v-container>
    <v-row justify="center">
      <v-col cols="12" sm="10" md="8">
        <v-card class="mb-4">
          <v-card-title>Authentication &amp; OIDC Settings</v-card-title>
          <v-card-text>
            <p class="text-body-2 mb-4">
              Configure your OpenID Connect (OIDC) identity provider. docPouch, EduID, or any standard OIDC issuer can be used for user authentication.
            </p>

            <v-form @submit.prevent="handleSave">
              <v-select
                v-model="providerType"
                label="OIDC Provider Type"
                :items="[
                  { title: 'docPouch (OIDC Provider)', value: 'docpouch' },
                  { title: 'EduID / Generic OpenID Connect', value: 'generic' }
                ]"
                item-title="title"
                item-value="value"
                variant="outlined"
                density="compact"
                class="mb-2"
              />

              <v-text-field
                v-model="oidcIssuer"
                label="OIDC Issuer URL"
                placeholder="http://localhost:3030/oidc"
                hint="The discovery / issuer URL of your OIDC identity provider"
                :rules="[urlRule]"
                variant="outlined"
                density="compact"
                required
              />

              <v-text-field
                v-model="oidcClientId"
                label="OIDC Client ID"
                placeholder="courseweaver-client"
                hint="Client ID registered with your OIDC provider"
                variant="outlined"
                density="compact"
              />

              <v-text-field
                v-if="providerType === 'docpouch'"
                v-model="oidcRegistrationToken"
                label="OIDC Registration Token"
                type="password"
                placeholder="TestToken"
                hint="One-time registration token for docPouch OIDC provider"
                variant="outlined"
                density="compact"
              />

              <v-divider class="my-4" />

              <h3 class="text-subtitle-1 font-weight-bold mb-2">PostgreSQL Database &amp; API Settings</h3>
              <p class="text-body-2 mb-4 text-medium-emphasis">
                CourseWeaver persists all academic curricula, modules, taxonomy, and room data in PostgreSQL using JSONB document storage.
              </p>

              <v-row>
                <v-col cols="12" md="8">
                  <v-text-field
                    v-model="dbApiUrl"
                    label="PostgreSQL Backend API URL"
                    placeholder="http://localhost:3000/api"
                    hint="REST/Backend endpoint interfacing with PostgreSQL JSONB storage"
                    variant="outlined"
                    density="compact"
                  />
                </v-col>
                <v-col cols="12" md="4">
                  <v-text-field
                    v-model="dbName"
                    label="Database Name"
                    placeholder="courseweaver"
                    variant="outlined"
                    density="compact"
                  />
                </v-col>
              </v-row>

              <v-row>
                <v-col cols="12" sm="8">
                  <v-text-field
                    v-model="dbHost"
                    label="PostgreSQL Host"
                    placeholder="localhost"
                    variant="outlined"
                    density="compact"
                  />
                </v-col>
                <v-col cols="12" sm="4">
                  <v-text-field
                    v-model="dbPort"
                    label="PostgreSQL Port"
                    type="number"
                    placeholder="5432"
                    variant="outlined"
                    density="compact"
                  />
                </v-col>
              </v-row>

              <v-alert v-if="registerError" type="error" density="compact" class="mt-2">
                {{ registerError }}
              </v-alert>

              <v-alert v-if="registerSuccess" type="success" density="compact" class="mt-2">
                Settings saved successfully! You can now log in via OIDC.
              </v-alert>

              <div class="d-flex gap-2 mt-4">
                <v-btn type="submit" color="primary" :loading="isRegistering">
                  Save Settings
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
import { useOidc, type OidcProviderType } from '@/composables/useOidc'
import { usePostgres } from '@/composables/usePostgres'

const router = useRouter()
const oidc = useOidc()
const postgres = usePostgres()

const providerType = ref<OidcProviderType>('generic')
const oidcIssuer = ref('')
const oidcClientId = ref('')
const oidcRegistrationToken = ref('')

const dbApiUrl = ref('')
const dbHost = ref('localhost')
const dbPort = ref('5432')
const dbName = ref('courseweaver')

const isRegistering = ref(false)
const registerError = ref('')
const registerSuccess = ref(false)

const urlRule = (v: string) =>
  !v || /^https?:\/\//i.test(v) || /^[^\s:]+$/i.test(v) || 'Enter a valid URL'

onMounted(() => {
  const oSettings = oidc.loadSettings()
  providerType.value = oSettings.providerType
  oidcIssuer.value = oSettings.issuer
  oidcClientId.value = oSettings.clientId
  oidcRegistrationToken.value = oSettings.registrationToken

  const pgSettings = postgres.loadSettings()
  dbApiUrl.value = pgSettings.apiUrl
  dbHost.value = pgSettings.host
  dbPort.value = pgSettings.port.toString()
  dbName.value = pgSettings.dbName
})

async function handleSave() {
  registerSuccess.value = false
  registerError.value = ''
  isRegistering.value = true

  try {
    oidc.saveSettings(
      oidcIssuer.value,
      oidcClientId.value,
      providerType.value,
      oidcRegistrationToken.value
    )

    postgres.saveSettings({
      apiUrl: dbApiUrl.value,
      host: dbHost.value,
      port: parseInt(dbPort.value) || 5432,
      dbName: dbName.value,
    })

    if (providerType.value === 'docpouch' && oidcRegistrationToken.value) {
      const ok = await oidc.performRegistration(oidcRegistrationToken.value)
      if (ok) {
        registerSuccess.value = true
      } else {
        registerError.value = oidc.registerError.value || 'OIDC registration failed.'
      }
    } else {
      registerSuccess.value = true
    }
  } catch (e: any) {
    registerError.value = e?.message || 'Failed to save settings.'
  } finally {
    isRegistering.value = false
  }
}

function handleClear() {
  oidc.clearSettings()
  postgres.clearSettings()
  oidcIssuer.value = ''
  oidcClientId.value = ''
  oidcRegistrationToken.value = ''
  providerType.value = 'generic'
  dbApiUrl.value = ''
  dbHost.value = 'localhost'
  dbPort.value = '5432'
  dbName.value = 'courseweaver'
  registerSuccess.value = false
}

function goBack() {
  router.push({ name: 'login' })
}
</script>
