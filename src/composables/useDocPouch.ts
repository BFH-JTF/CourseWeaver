import { ref, computed } from 'vue'
import docPouchClient from 'docpouch-client'

const STORAGE_KEYS = {
  url: 'courseweaver_docpouch_url',
  port: 'courseweaver_docpouch_port',
  registrationToken: 'courseweaver_oidc_registration_token',
  clientId: 'courseweaver_oidc_client_id',
  realtimeEnabled: 'courseweaver_realtime_enabled',
} as const

const url = ref(localStorage.getItem(STORAGE_KEYS.url) || '')
const port = ref(parseInt(localStorage.getItem(STORAGE_KEYS.port) || '0'))
const registrationToken = ref(localStorage.getItem(STORAGE_KEYS.registrationToken) || '')
const realtimeEnabled = ref(localStorage.getItem(STORAGE_KEYS.realtimeEnabled) === 'true')
const isAuthenticated = ref(false)
const authMethod = ref<'none' | 'jwt' | 'oidc'>('none')
const authError = ref('')
const isRegistering = ref(false)
const registerError = ref('')
const client = ref<docPouchClient | null>(null)

const isConfigured = computed(() => !!url.value && port.value > 0)
const clientId = computed(() =>
  localStorage.getItem(STORAGE_KEYS.clientId)
  || localStorage.getItem('docpouch_oidc_client_id')
  || ''
)

function getCallbackUrl(): string {
  return window.location.origin + '/callback'
}

function normalizeBaseUrl(rawUrl: string, portNum: number): string {
  let base = rawUrl.trim()
  if (!base) return ''
  if (!base.match(/^https?:\/\//i)) {
    base = 'http://' + base
  }
  base = base.replace(/\/+$/, '')
  if (!isNaN(portNum) && portNum > 0 && !/:\d+(?=\/|$)/.test(base)) {
    base += ':' + portNum
  }
  return base
}

function getBaseUrl(): string {
  if (!isConfigured.value) return ''
  return normalizeBaseUrl(url.value, port.value)
}

const initClient = (baseUrl: string) => {
  client.value = new docPouchClient(baseUrl, 0, (event: string, data: unknown) => {
    if (realtimeEnabled.value) {
      console.log('DocPouch Event:', event, data)
    }
  })
}

async function initService(): Promise<boolean> {
  const baseUrl = getBaseUrl()
  if (!baseUrl) return false

  initClient(baseUrl)
  if (!client.value) return false

  try {
    const authState = await client.value.initAuth()
    if (authState.method !== 'none' && authState.token) {
      isAuthenticated.value = true
      authMethod.value = authState.method as 'jwt' | 'oidc'
      if (authMethod.value === 'oidc') {
        const storedClientId =
          localStorage.getItem(STORAGE_KEYS.clientId)
          || localStorage.getItem('docpouch_oidc_client_id')
        if (storedClientId) {
          localStorage.setItem(STORAGE_KEYS.clientId, storedClientId)
          const redirectUri = getCallbackUrl()
          const postLogoutProxy = `${baseUrl}/oidc/logout-redirect?post_logout_redirect_uri=${encodeURIComponent(redirectUri)}`
          client.value.setOidcConfig({
            issuer: client.value.getOidcIssuer(),
            clientId: storedClientId,
            redirectUri,
            postLogoutRedirectUri: postLogoutProxy,
            scope: 'openid profile email offline_access',
          })
        }
        realtimeEnabled.value = true
      }
      return true
    }
  } catch (err) {
    console.error('initAuth failed:', err)
  }

  isAuthenticated.value = false
  authMethod.value = 'none'
  return false
}

async function loginWithOidc(tokenParam?: string): Promise<void> {
  const baseUrl = getBaseUrl()
  if (!baseUrl) {
    authError.value = 'DocPouch server is not configured. Set the URL and port in Server Settings first.'
    throw new Error(authError.value)
  }
  if (!client.value) {
    initClient(baseUrl)
  }
  if (!client.value) return

  authError.value = ''
  try {
    const redirectUri = getCallbackUrl()
    const postLogoutProxy = `${baseUrl}/oidc/logout-redirect?post_logout_redirect_uri=${encodeURIComponent(redirectUri)}`
    const effectiveToken = tokenParam || registrationToken.value || undefined
    const effectiveClientId = await client.value.ensureOidcClient(redirectUri, effectiveToken, {
      clientName: 'CourseWeaver',
      postLogoutRedirectUri: postLogoutProxy,
    })
    localStorage.setItem(STORAGE_KEYS.clientId, effectiveClientId)
    const issuer = client.value.getOidcIssuer()
    await client.value.loginWithOidc({
      issuer,
      clientId: effectiveClientId,
      redirectUri,
      postLogoutRedirectUri: postLogoutProxy,
      scope: 'openid profile email offline_access',
    })
  } catch (err: any) {
    authError.value = err.message || 'OIDC login failed'
    throw err
  }
}

async function performRegistration(token: string): Promise<boolean> {
  const baseUrl = getBaseUrl()
  if (!baseUrl) {
    registerError.value = 'DocPouch server is not configured. Set the URL and port in Server Settings first.'
    return false
  }
  if (!client.value) {
    initClient(baseUrl)
  }
  if (!client.value) return false

  isRegistering.value = true
  registerError.value = ''
  try {
    const redirectUri = getCallbackUrl()
    const postLogoutProxy = `${baseUrl}/oidc/logout-redirect?post_logout_redirect_uri=${encodeURIComponent(redirectUri)}`
    const resolvedClientId = await client.value.ensureOidcClient(redirectUri, token, {
      clientName: 'CourseWeaver',
      postLogoutRedirectUri: postLogoutProxy,
    })
    localStorage.setItem(STORAGE_KEYS.clientId, resolvedClientId)
    return true
  } catch (e: any) {
    console.error('OIDC client registration failed:', e)
    registerError.value = e?.message || 'Registration failed.'
    return false
  } finally {
    isRegistering.value = false
  }
}

async function logout() {
  if (!client.value) return
  try {
    const auth = client.value.getAuthMethod()
    if (auth === 'oidc') {
      const redirectUri = getCallbackUrl()
      const postLogoutProxy = `${getBaseUrl()}/oidc/logout-redirect?post_logout_redirect_uri=${encodeURIComponent(redirectUri)}`
      await client.value.logoutOidc({ redirectUri: postLogoutProxy })
      return
    }
    await client.value.logout()
  } catch (err) {
    console.warn('Logout failed, clearing local state:', err)
    if (client.value) {
      client.value.clearAuth()
    }
  }
  isAuthenticated.value = false
  authMethod.value = 'none'
  realtimeEnabled.value = false
}

function saveSettings(newUrl: string, newPort: number, newRegistrationToken: string) {
  url.value = newUrl
  port.value = newPort
  localStorage.setItem(STORAGE_KEYS.url, newUrl)
  localStorage.setItem(STORAGE_KEYS.port, newPort.toString())

  if (newRegistrationToken) {
    registrationToken.value = newRegistrationToken
    localStorage.setItem(STORAGE_KEYS.registrationToken, newRegistrationToken)
  }

  const baseUrl = normalizeBaseUrl(newUrl, newPort)
  initClient(baseUrl)
}

function clearSettings() {
  url.value = ''
  port.value = 0
  registrationToken.value = ''
  localStorage.removeItem(STORAGE_KEYS.url)
  localStorage.removeItem(STORAGE_KEYS.port)
  localStorage.removeItem(STORAGE_KEYS.registrationToken)
  localStorage.removeItem(STORAGE_KEYS.realtimeEnabled)
  localStorage.removeItem(STORAGE_KEYS.clientId)
  if (client.value) {
    client.value.clearPersistedAuthState()
  } else {
    localStorage.removeItem('docpouch_oidc_session')
    localStorage.removeItem('docpouch_oidc_client_id')
    localStorage.removeItem('docpouch_registration_token')
    localStorage.removeItem('authToken')
    localStorage.removeItem('authMethod')
  }
}

function clearAuthError() {
  authError.value = ''
}

function enableRealtimeIfConfigured() {
  if (realtimeEnabled.value && client.value) {
    client.value.setRealTimeSync(true)
  }
}

function toggleRealtime(enabled: boolean) {
  realtimeEnabled.value = enabled
  localStorage.setItem(STORAGE_KEYS.realtimeEnabled, enabled.toString())
  if (client.value) {
    client.value.setRealTimeSync(enabled)
  }
}

function loadSettings(): { url: string; port: string; registrationToken: string } {
  return {
    url: url.value,
    port: port.value.toString(),
    registrationToken: localStorage.getItem(STORAGE_KEYS.registrationToken) || '',
  }
}

function hasOidcCallbackParams(): boolean {
  const params = new URLSearchParams(window.location.search)
  return params.has('code') && params.has('state')
}

export function useDocPouch() {
  return {
    client,
    url,
    port,
    registrationToken,
    clientId,
    realtimeEnabled,
    isConfigured,
    isAuthenticated,
    authMethod,
    authError,
    isRegistering,
    registerError,
    initService,
    loginWithOidc,
    performRegistration,
    logout,
    saveSettings,
    clearSettings,
    clearAuthError,
    enableRealtimeIfConfigured,
    toggleRealtime,
    loadSettings,
    getBaseUrl,
    hasOidcCallbackParams,
  }
}