import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { io } from 'socket.io-client'

export const FIBONACCI_VALUES = [1, 2, 3, 5, 8, 13, 21, 34]
export const JOKER_VALUE = 'joker'

const PLAYER_ID_STORAGE_KEY = 'planning-poker-player-id'
const RECONNECT_ATTEMPTS = 8

function getOrCreatePlayerId() {
  if (typeof sessionStorage === 'undefined') {
    return crypto.randomUUID()
  }
  const existing = sessionStorage.getItem(PLAYER_ID_STORAGE_KEY)
  if (existing) return existing
  const id = crypto.randomUUID()
  sessionStorage.setItem(PLAYER_ID_STORAGE_KEY, id)
  return id
}

export const usePokerStore = defineStore('poker', () => {
  const isRevealed = ref(false)
  const sessionId = ref(null)
  const playerId = ref(null)
  const players = ref([]) // [{ id, name }]
  const selections = ref({}) // { [playerId]: value }
  const socket = ref(null)
  const isConnected = ref(false)

  const allCards = computed(() => [
    ...FIBONACCI_VALUES.map((v) => ({ value: v, type: 'number' })),
    { value: JOKER_VALUE, type: 'joker' },
  ])

  const currentUserCard = computed(() => {
    if (!playerId.value) return null
    return selections.value[playerId.value] ?? null
  })

  const allSelections = computed(() => {
    const map = new Map()
    players.value.forEach((p) => {
      const value = selections.value[p.id]
      if (value != null) {
        map.set(p.name, value)
      }
    })
    return Object.fromEntries(map)
  })

  const numericValuesForAverage = computed(() => {
    const values = Object.values(allSelections.value).filter((v) => v !== JOKER_VALUE)
    return values.map(Number)
  })

  const average = computed(() => {
    const values = numericValuesForAverage.value
    if (values.length === 0) return null
    const sum = values.reduce((a, b) => a + b, 0)
    return Math.round((sum / values.length) * 10) / 10
  })

  const distribution = computed(() => {
    const values = numericValuesForAverage.value
    const counts = {}
    FIBONACCI_VALUES.forEach((v) => (counts[v] = 0))
    values.forEach((v) => {
      counts[v] = (counts[v] ?? 0) + 1
    })
    return counts
  })

  const tableState = computed(() => {
    if (isRevealed.value) return 'revealed'
    if (!currentUserCard.value) return 'waiting_for_players'
    return 'all_players_ready'
  })

  const allPlayersHaveSelected = computed(() => {
    const ps = players.value
    if (!ps.length) return false
    return ps.every((p) => selections.value[p.id] != null)
  })

  function applyState(payload) {
    sessionId.value = payload.sessionId
    isRevealed.value = payload.isRevealed
    players.value = payload.players || []
    selections.value = payload.selections || {}
  }

  function connect({ name, mode, initialSessionId }) {
    if (socket.value) return
    sessionId.value = null
    players.value = []
    selections.value = {}
    isRevealed.value = false

    if (typeof window === 'undefined') return

    const stablePlayerId = getOrCreatePlayerId()
    playerId.value = stablePlayerId

    let helloMode = mode
    let helloSessionId = initialSessionId || null

    const s = io({
      path: '/socket.io-poker',
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: RECONNECT_ATTEMPTS,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    })
    socket.value = s

    s.on('connect', () => {
      isConnected.value = true
      s.emit('hello', {
        name,
        playerId: stablePlayerId,
        mode: helloSessionId ? 'join' : helloMode,
        sessionId: helloSessionId,
      })
    })

    s.on('welcome', (payload) => {
      const { you, ...state } = payload
      if (you?.id) {
        playerId.value = you.id
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(PLAYER_ID_STORAGE_KEY, you.id)
        }
      }
      applyState(state)
      if (state.sessionId) {
        helloSessionId = state.sessionId
        helloMode = 'join'
      }
    })

    s.on('state', (payload) => {
      applyState(payload)
      if (payload.sessionId) {
        helloSessionId = payload.sessionId
        helloMode = 'join'
      }
    })

    s.on('disconnect', () => {
      isConnected.value = false
    })

    s.io.on('reconnect_failed', () => {
      if (socket.value !== s || typeof window === 'undefined') return
      window.location.reload()
    })
  }

  function selectCard(value) {
    if (!socket.value || !isConnected.value || isRevealed.value) return
    socket.value.emit('select_card', value)
  }

  function reveal() {
    if (!socket.value || !isConnected.value) return
    socket.value.emit('reveal')
  }

  function reset() {
    if (!socket.value || !isConnected.value) return
    socket.value.emit('reset')
  }

  function leaveSession() {
    const s = socket.value
    socket.value = null
    if (s) {
      s.emit('leave')
      s.disconnect()
    }
    isConnected.value = false
    sessionId.value = null
    playerId.value = null
    players.value = []
    selections.value = {}
    isRevealed.value = false
  }

  return {
    // state
    isRevealed,
    sessionId,
    playerId,
    players,
    selections,
    isConnected,
    // computed
    currentUserCard,
    tableState,
    allPlayersHaveSelected,
    allCards,
    allSelections,
    average,
    distribution,
    numericValuesForAverage,
    // actions
    connect,
    selectCard,
    reveal,
    reset,
    leaveSession,
  }
})
