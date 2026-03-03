import { Server as SocketIOServer } from 'socket.io'
import { v4 as uuidv4 } from 'uuid'

const IO_PATH = '/socket.io-poker'

/**
 * sessions: Map<sessionId, {
 *   players: Map<playerId, { id, name }>,
 *   selections: Map<playerId, value>,
 *   isRevealed: boolean
 * }>
 */
const sessions = new Map()

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

    socket.on('hello', ({ name, mode, sessionId: requestedId }) => {
      if (!name) return

      let sessionId = requestedId
      if (mode === 'create' || !sessionId) {
        sessionId = uuidv4()
      }

      let session = sessions.get(sessionId)
      if (!session) {
        session = {
          players: new Map(),
          selections: new Map(),
          isRevealed: false,
        }
        sessions.set(sessionId, session)
      }

      const playerId = socket.id
      currentSessionId = sessionId
      currentPlayerId = playerId

      session.players.set(playerId, { id: playerId, name })
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
      if (!currentSessionId) return
      const session = sessions.get(currentSessionId)
      if (!session) return
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

    socket.on('disconnect', () => {
      if (!currentSessionId || !currentPlayerId) return
      const session = sessions.get(currentSessionId)
      if (!session) return
      session.players.delete(currentPlayerId)
      session.selections.delete(currentPlayerId)
      if (session.players.size === 0) {
        sessions.delete(currentSessionId)
      } else {
        broadcastState(io, currentSessionId)
      }
    })
  })

  return io
}
