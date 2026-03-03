import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { attachPokerWs } from './server/ws-handler.js'

export default defineConfig({
  plugins: [
    vue(),
    {
      name: 'poker-ws',
      configureServer(server) {
        if (server.httpServer) {
          attachPokerWs(server.httpServer)
        }
      },
    },
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
