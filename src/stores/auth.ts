import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useOidc } from '@/composables/useOidc'

export const useAuthStore = defineStore('auth', () => {
  const oidc = useOidc()

  const userName = ref<string>('')
  const isAdmin = ref(false)

  const isAuthenticated = computed(() => oidc.isAuthenticated.value)
  const authMethod = computed(() => oidc.authMethod.value)

  async function loginWithOidc(registrationToken?: string) {
    await oidc.loginWithOidc(registrationToken)
  }

  async function logout() {
    await oidc.logout()
    userName.value = ''
    isAdmin.value = false
  }

  async function initAuth() {
    const authenticated = await oidc.initAuth()
    if (authenticated && oidc.currentUser.value) {
      userName.value = oidc.currentUser.value.name || ''
      isAdmin.value = !!oidc.currentUser.value.isAdmin
    } else {
      userName.value = ''
      isAdmin.value = false
    }
    return authenticated
  }

  return {
    userName,
    isAdmin,
    isAuthenticated,
    authMethod,
    loginWithOidc,
    logout,
    initAuth,
  }
})