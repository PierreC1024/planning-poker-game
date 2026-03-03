import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useUserStore } from './user'

describe('useUserStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear()
    }
  })

  it('trims and stores the user name', () => {
    const store = useUserStore()
    store.setUserName('  Alice  ')

    expect(store.userName).toBe('Alice')
  })

  it('clears the user name and storage', () => {
    const store = useUserStore()
    store.setUserName('Bob')
    store.clearUser()

    expect(store.userName).toBe('')
  })
})
