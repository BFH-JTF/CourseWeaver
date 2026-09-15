import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useDocPouch } from '@/composables/useDocPouch'

export const useAuthStore = defineStore('auth', () => {
  const docPouch = useDocPouch()

  const userName = ref<string>('')
  const isAdmin = ref(false)

  const isAuthenticated = computed(() => docPouch.isAuthenticated.value)
  const authMethod = computed(() => docPouch.authMethod.value)

  async function loginWithOidc(registrationToken?: string) {
    await docPouch.loginWithOidc(registrationToken)
  }

  async function logout() {
    await docPouch.logout()
    userName.value = ''
    isAdmin.value = false
  }

  async function initAuth() {
    const authenticated = await docPouch.initService()
    if (authenticated && docPouch.client.value) {
      try {
        const userInfo = await docPouch.client.value.getCurrentUser()
        if (userInfo) {
          userName.value = userInfo.name || ''
          isAdmin.value = !!userInfo.isAdmin
        }
      } catch {
        const authState = await docPouch.client.value.initAuth()
        userName.value = authState.userName || ''
        isAdmin.value = authState.isAdmin
      }
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