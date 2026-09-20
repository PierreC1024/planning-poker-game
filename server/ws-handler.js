import { Server as SocketIOServer } from 'socket.io'
import { v4 as uuidv4 } from 'uuid'

const IO_PATH = '/socket.io-poker'
const LEAVE_GRACE_MS = 8000

/**
 * sessions: Map<sessionId, {
 *   players: Map<playerId, { id, name, socketId }>,
 *   selections: Map<playerId, value>,
 *   leaveTimers: Map<playerId, ReturnType<typeof setTimeout>>,
 *   isRevealed: boolean
 * }>
 */
const sessions = new Map()

function normalizePlayerId(requested) {
  if (typeof requested !== 'string') return uuidv4()
  const trimmed = requested.trim()
  if (!trimmed || trimmed.length > 64) return uuidv4()
  return trimmed
}

function getSessionState(sessionId) {
  const session = sessions.get(sessionId)
  if (!session) return null

  const players = Array.from(session.players.values()).map(({ id, name }) => ({
    id,
    name,
  }))
  const selections = {}
  session.selections.forEach((value, playerId) => {
    selections[playerId] = value
  })

  return {
    sessionId,
    players,
    selections,
    isRevealed: session.isRevealed,
  }
}

function broadcastState(io, sessionId) {
  const session = sessions.get(sessionId)
  if (!session) return
  const state = getSessionState(sessionId)
  io.to(sessionId).emit('state', state)
}

function cancelLeave(session, playerId) {
  const timer = session.leaveTimers.get(playerId)
  if (!timer) return
  clearTimeout(timer)
  session.leaveTimers.delete(playerId)
}

function removePlayer(io, sessionId, playerId, socketId) {
  const session = sessions.get(sessionId)
  if (!session) return
  const player = session.players.get(playerId)
  if (!player) return
  if (socketId && player.socketId !== socketId) return

  cancelLeave(session, playerId)
  session.players.delete(playerId)
  session.selections.delete(playerId)

  if (session.players.size === 0) {
    for (const timer of session.leaveTimers.values()) clearTimeout(timer)
    sessions.delete(sessionId)
    return
  }

  broadcastState(io, sessionId)
}

function createSession() {
  return {
    players: new Map(),
    selections: new Map(),
    leaveTimers: new Map(),
    isRevealed: false,
  }
}

/**
 * Attach the Planning Poker Socket.IO server to an existing HTTP server.
 * Clients connect on the same origin using Socket.IO with path IO_PATH.
 * @param {import('http').Server} httpServer
 */
export function attachPokerWs(httpServer) {
  if (!httpServer) return
  const io = new SocketIOServer(httpServer, {
    path: IO_PATH,
  })

  io.on('connection', (socket) => {
    let currentSessionId = null
    let currentPlayerId = null

    socket.on('hello', (payload) => {
      if (!payload || typeof payload !== 'object') return
      const { name, mode, sessionId: requestedId, playerId: requestedPlayerId } = payload
      if (!name) return

      let sessionId = requestedId
      if (mode === 'create' || !sessionId) {
        sessionId = uuidv4()
      }

      let session = sessions.get(sessionId)
      if (!session) {
        session = createSession()
        sessions.set(sessionId, session)
      }

      const playerId = normalizePlayerId(requestedPlayerId)
      cancelLeave(session, playerId)

      currentSessionId = sessionId
      currentPlayerId = playerId

      const existing = session.players.get(playerId)
      if (existing) {
        existing.name = name
        existing.socketId = socket.id
      } else {
        session.players.set(playerId, { id: playerId, name, socketId: socket.id })
      }
      socket.join(sessionId)

      const welcomePayload = {
        you: { id: playerId, name },
        ...getSessionState(sessionId),
      }
      socket.emit('welcome', welcomePayload)
      broadcastState(io, sessionId)
    })

    socket.on('select_card', (value) => {
      if (!currentSessionId || !currentPlayerId) return
      const session = sessions.get(currentSessionId)
      if (!session || session.isRevealed) return
      session.selections.set(currentPlayerId, value)
      broadcastState(io, currentSessionId)
    })

    socket.on('reveal', () => {
      if (!currentSessionId || !currentPlayerId) return
      const session = sessions.get(currentSessionId)
      if (!session) return
      if (!session.selections.has(currentPlayerId)) return
      session.isRevealed = true
      broadcastState(io, currentSessionId)
    })

    socket.on('reset', () => {
      if (!currentSessionId) return
      const session = sessions.get(currentSessionId)
      if (!session) return
      session.isRevealed = false
      session.selections.clear()
      broadcastState(io, currentSessionId)
    })

    socket.on('leave', () => {
      if (!currentSessionId || !currentPlayerId) return
      const sessionId = currentSessionId
      const playerId = currentPlayerId
      currentSessionId = null
      currentPlayerId = null
      removePlayer(io, sessionId, playerId, socket.id)
    })

    socket.on('disconnect', () => {
      if (!currentSessionId || !currentPlayerId) return
      const session = sessions.get(currentSessionId)
      if (!session) return
      const player = session.players.get(currentPlayerId)
      if (!player || player.socketId !== socket.id) return

      const sessionId = currentSessionId
      const playerId = currentPlayerId
      const socketId = socket.id
      cancelLeave(session, playerId)
      const timer = setTimeout(() => {
        removePlayer(io, sessionId, playerId, socketId)
      }, LEAVE_GRACE_MS)
      session.leaveTimers.set(playerId, timer)
    })
  })

  return io
}
