import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'registration',
      component: () => import('@/views/RegistrationPage.vue'),
      meta: { requiresGuest: true },
    },
    {
      path: '/session/:sessionId',
      name: 'session',
      component: () => import('@/views/PlanningPokerPage.vue'),
      meta: { requiresAuth: true },
    },
  ],
})

router.beforeEach((to, _from, next) => {
  const userStore = useUserStore()
  const hasName = !!userStore.userName

  if (to.meta.requiresAuth && !hasName) {
    // Coming from a shared session link: remember the target sessionId in the query
    if (to.name === 'session' && to.params.sessionId) {
      next({
        name: 'registration',
        query: { sessionId: String(to.params.sessionId) },
      })
      return
    }
    next({ name: 'registration' })
    return
  }

  if (to.meta.requiresGuest && hasName && to.name === 'registration') {
    next({ name: 'session', params: { sessionId: 'new' } })
    return
  }

  next()
})

export default router
