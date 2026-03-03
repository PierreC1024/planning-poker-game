<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const name = ref(userStore.userName || '')
const sessionIdInput = ref('')
const error = ref('')
const joinError = ref('')
const pendingSessionId = computed(() => route.query.sessionId || null)

function ensureName() {
  const trimmed = name.value.trim()
  if (!trimmed) {
    error.value = 'Please enter your name.'
    return null
  }
  error.value = ''
  userStore.setUserName(trimmed)
  return trimmed
}

function createSession() {
  const validName = ensureName()
  if (!validName) return
  router.push({ name: 'session', params: { sessionId: 'new' } })
}

function joinSession() {
  const validName = ensureName()
  if (!validName) return
  const trimmedId = sessionIdInput.value.trim()
  if (!trimmedId) {
    joinError.value = 'Please enter a session ID.'
    return
  }
  joinError.value = ''
  router.push({ name: 'session', params: { sessionId: trimmedId } })
}

function continueToPendingSession() {
  const validName = ensureName()
  if (!validName) return
  const target = String(pendingSessionId.value || '').trim()
  if (!target) return
  router.push({ name: 'session', params: { sessionId: target } })
}
</script>

<template>
  <div class="registration-page">
    <div class="registration-card">
      <h1>Planning Poker Game</h1>
      <p class="subtitle">Choose a name and create or join a session</p>

      <div class="section">
        <label class="label" for="name">Your name</label>
        <input
          id="name"
          v-model="name"
          type="text"
          placeholder="Your name"
          class="input"
          autofocus
          autocomplete="name"
        />
        <p v-if="error" class="error">{{ error }}</p>
      </div>

      <div v-if="!pendingSessionId" class="section section-sessions">
        <button type="button" class="btn btn-primary" @click="createSession">
          Create new session
        </button>

        <div class="divider">
          <span>or</span>
        </div>

        <div class="join-row">
          <input
            v-model="sessionIdInput"
            type="text"
            placeholder="Existing session ID"
            class="input join-input"
          />
          <button type="button" class="btn btn-join" @click="joinSession">Join</button>
        </div>
        <p v-if="joinError" class="error">{{ joinError }}</p>
      </div>

      <div v-else class="section section-sessions">
        <button type="button" class="btn btn-primary" @click="continueToPendingSession">
          Continue to session
        </button>
        <p class="pending-hint">
          You opened a shared link. You&#39;ll join session
          <strong>{{ pendingSessionId }}</strong>
          after entering your name.
        </p>
      </div>
    </div>

    <footer class="app-footer">Created by <span>Data-Fullstack</span></footer>
  </div>
</template>

<style scoped>
.registration-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  padding: 1rem;
  position: relative;
}

.registration-card {
  background: #fff;
  border-radius: 12px;
  padding: 2.5rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 100%;
  max-width: 380px;
}

h1 {
  font-size: 1.75rem;
  color: #1a1a2e;
  margin-bottom: 0.5rem;
  text-align: center;
}

.subtitle {
  color: #64748b;
  font-size: 0.95rem;
  margin-bottom: 1.5rem;
  text-align: center;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
}

.label {
  font-size: 0.85rem;
  color: #64748b;
}

.input {
  padding: 0.75rem 1rem;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.input:focus {
  outline: none;
  border-color: var(--color-felt, #0d5c2e);
}

.error {
  color: #dc2626;
  font-size: 0.875rem;
  margin: -0.25rem 0 0;
}

.btn {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  transition:
    background 0.2s,
    transform 0.1s;
}

.btn:active {
  transform: scale(0.98);
}

.btn-primary {
  background: var(--color-felt, #0d5c2e);
  color: #fff;
}

.btn-primary:hover {
  background: var(--color-felt-border, #0a4723);
}

.section-sessions {
  margin-top: 0.25rem;
}

.pending-hint {
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: #64748b;
  text-align: center;
}

.divider {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 0.75rem 0;
  font-size: 0.8rem;
  color: #94a3b8;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #e2e8f0;
}

.join-row {
  display: flex;
  gap: 0.5rem;
}

.join-input {
  flex: 1;
}

.btn-join {
  background: #e2e8f0;
  color: #0f172a;
}

.btn-join:hover {
  background: #cbd5f5;
}

.app-footer {
  position: fixed;
  inset-inline: 0;
  bottom: 0;
  padding: 0.75rem 1rem 0.85rem;
  text-align: center;
  font-size: 0.7rem;
  color: #94a3b8;
}

.app-footer span {
  font-weight: 600;
}
</style>
