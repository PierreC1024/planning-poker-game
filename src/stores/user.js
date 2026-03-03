import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const STORAGE_KEY = 'planning-poker-user'

export const useUserStore = defineStore('user', () => {
  const userName = ref(
    typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(STORAGE_KEY) ?? '' : ''
  )

  watch(
    userName,
    (name) => {
      if (typeof sessionStorage !== 'undefined') {
        if (name) {
          sessionStorage.setItem(STORAGE_KEY, name)
        } else {
          sessionStorage.removeItem(STORAGE_KEY)
        }
      }
    },
    { immediate: true }
  )

  function setUserName(name) {
    userName.value = (name || '').trim()
  }

  function clearUser() {
    userName.value = ''
  }

  return {
    userName,
    setUserName,
    clearUser,
  }
})
