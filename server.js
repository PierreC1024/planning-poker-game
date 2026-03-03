import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { attachPokerWs } from './server/ws-handler.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 5173
const distPath = path.join(__dirname, 'dist')

const app = express()
app.use(express.static(distPath))
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

const server = app.listen(PORT, () => {
  attachPokerWs(server)
  // eslint-disable-next-line no-console
  console.log(`App + WebSocket: http://localhost:${PORT} (ws://localhost:${PORT}/ws)`)
})
