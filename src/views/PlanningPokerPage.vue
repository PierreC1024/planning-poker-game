<script setup>
import { onMounted, watch, computed, ref, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { usePokerStore, JOKER_VALUE } from '@/stores/poker'
import PlayerList from '@/components/poker/PlayerList.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const poker = usePokerStore()

const userName = computed(() => userStore.userName)
const idCopyFeedback = ref(false)
const linkCopyFeedback = ref(false)

const hasSelection = computed(() => poker.currentUserCard !== null)
const isCurrentPlayer = (id) => poker.playerId === id
const playerHasPlayed = (id) => poker.selections[id] != null
const otherPlayers = computed(() =>
  poker.players.filter((p) => p.id !== poker.playerId),
)
const mockPlayerWidthCh = computed(() => {
  const names = poker.players.map((p) => (p.name || '').length)
  const maxLen = names.length ? Math.max(12, ...names) : 12
  return `${maxLen}ch`
})
function getPlayerCard(id) {
  return poker.selections[id] ?? null
}
const tableState = computed(() => poker.tableState)
const canReveal = computed(() => Object.keys(poker.allSelections).length > 0)
const showRevealModal = computed(() => poker.isRevealed && canReveal.value)

const scoreRows = computed(() => {
  const dist = poker.distribution
  const numericEntries = Object.entries(dist).filter(([, count]) => count > 0)

  const coffeeNames = poker.players
    .filter((p) => poker.selections[p.id] === JOKER_VALUE)
    .map((p) => p.name)
  const coffeeCount = coffeeNames.length

  const countsForScale = [
    ...numericEntries.map(([, count]) => count),
    ...(coffeeCount > 0 ? [coffeeCount] : []),
  ]

  if (!countsForScale.length) return []

  const maxCount = Math.max(...countsForScale)

  const rows = numericEntries
    .map(([value, count]) => {
      const numeric = Number(value)
      const names = poker.players
        .filter((p) => poker.selections[p.id] === numeric)
        .map((p) => p.name)
      return {
        value: numeric,
        isCoffee: false,
        count,
        widthPercent: (count / maxCount) * 100,
        names,
      }
    })
    .sort((a, b) => a.value - b.value)

  if (coffeeCount > 0) {
    rows.push({
      value: '☕',
      isCoffee: true,
      count: coffeeCount,
      widthPercent: (coffeeCount / maxCount) * 100,
      names: coffeeNames,
    })
  }

  return rows
})

function isCardPicked(card) {
  return poker.currentUserCard === card.value
}

function selectCard(value) {
  poker.selectCard(value)
}

function reveal() {
  poker.reveal()
}

function reset() {
  poker.reset()
}

function exitSession() {
  poker.leaveSession()
  userStore.clearUser()
  router.push({ name: 'registration' })
}

function copySessionId() {
  if (!poker.sessionId) return
  navigator.clipboard.writeText(poker.sessionId).then(() => {
    idCopyFeedback.value = true
    setTimeout(() => {
      idCopyFeedback.value = false
    }, 2000)
  })
}

function copySessionUrl() {
  if (!poker.sessionId) return
  const path = router.resolve({ name: 'session', params: { sessionId: poker.sessionId } }).fullPath
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || ''
  const url = `${window.location.origin}${base}${path}`
  navigator.clipboard.writeText(url).then(() => {
    linkCopyFeedback.value = true
    setTimeout(() => {
      linkCopyFeedback.value = false
    }, 2000)
  })
}

onMounted(() => {
  const sessionIdParam = route.params.sessionId
  const isCreate = sessionIdParam === 'new'
  const mode = isCreate ? 'create' : 'join'
  const initialSessionId = isCreate ? null : sessionIdParam
  poker.connect({ name: userName.value, mode, initialSessionId })
})

watch(
  () => poker.sessionId,
  (newId) => {
    if (!newId) return
    if (route.params.sessionId === 'new') {
      nextTick(() => {
        router.replace({ name: 'session', params: { sessionId: newId } })
      })
    }
  },
  { immediate: true }
)

watch(
  () => poker.allPlayersHaveSelected && !poker.isRevealed,
  (shouldAutoReveal) => {
    if (shouldAutoReveal) poker.reveal()
  }
)
</script>

<template>
  <div class="poker-page">
    <h1 class="page-title">Planning Poker Game</h1>
    <header class="poker-header">
      <div class="players-list-wrap">
        <div class="players-list-title">Players</div>
        <PlayerList
          :players="poker.players"
          :current-player-id="poker.playerId"
          :selections="poker.selections"
        />
      </div>
      <div class="session-actions">
        <template v-if="poker.sessionId">
          <button
            type="button"
            class="session-pill session-pill-clickable"
            :title="idCopyFeedback ? 'Copied!' : 'Click to copy session ID'"
            @click="copySessionId"
          >
            {{ idCopyFeedback ? 'Copied!' : `Session: ${poker.sessionId}` }}
          </button>
          <button
            type="button"
            class="btn btn-share"
            :title="linkCopyFeedback ? 'Copied!' : 'Copy session link'"
            @click="copySessionUrl"
          >
            {{ linkCopyFeedback ? 'Copied' : 'Share' }}
          </button>
        </template>
        <button
          type="button"
          class="btn btn-exit"
          title="Leave session and return to name & session"
          @click="exitSession"
        >
          Exit
        </button>
      </div>
      <button v-if="poker.isRevealed" class="btn btn-reset" @click="reset">New vote</button>
    </header>

    <div class="table">
      <div class="table-inner">
        <!-- Hand: all cards; picked card keeps its space with shadow -->
        <div class="hand">
          <template v-for="card in poker.allCards" :key="card.value">
            <div
              v-if="isCardPicked(card)"
              class="card-btn card-btn-hand card-picked"
              aria-hidden="true"
            >
              <span class="card-label card-label-top">
                {{ card.type === 'joker' ? '☕' : card.value }}
              </span>
              <span class="card-value-main card-picked-value">
                {{ card.type === 'joker' ? '☕' : card.value }}
              </span>
              <span class="card-label card-label-bottom">
                {{ card.type === 'joker' ? '☕' : card.value }}
              </span>
            </div>
            <button
              v-else
              type="button"
              class="card-btn card-btn-hand"
              :class="{ 'card-btn-hint': tableState === 'waiting_for_players' }"
              :disabled="poker.isRevealed"
              @click="selectCard(card.value)"
            >
              <span class="card-label card-label-top">
                {{ card.type === 'joker' ? '☕' : card.value }}
              </span>
              <span class="card-value-main">
                {{ card.type === 'joker' ? '☕' : card.value }}
              </span>
              <span class="card-label card-label-bottom">
                {{ card.type === 'joker' ? '☕' : card.value }}
              </span>
            </button>
          </template>
        </div>
        <!-- Center: hint + waiting OR selected card + reveal (one replaces the other) -->
        <div class="center-block">
          <template v-if="!hasSelection">
            <div class="hint-and-waiting">
              <p
                v-if="tableState === 'waiting_for_players'"
                class="hint-text"
              >
                Pick a card to join this vote.
              </p>
              <div class="waiting-for-you-slot">
                <div
                  v-if="tableState === 'waiting_for_players'"
                  class="waiting-for-you"
                >
                  Waiting for you
                </div>
              </div>
            </div>
          </template>
          <template v-else>
            <div class="center-card-wrapper">
              <div
                class="center-card"
                :class="{ flipped: poker.isRevealed }"
              >
                <div class="center-card-face center-card-back">?</div>
                <div class="center-card-face center-card-front">
                {{ poker.currentUserCard === JOKER_VALUE ? '☕' : poker.currentUserCard }}
                </div>
              </div>
            </div>
            <button
              v-if="canReveal && !poker.isRevealed"
              class="btn btn-reveal"
              :class="{ 'btn-reveal-ready': tableState === 'all_players_ready' }"
              @click="reveal"
            >
              Reveal
            </button>
          </template>
        </div>

        <!-- Other players on the table: each connected player with status -->
        <div class="mock-players" :style="{ '--mock-player-width': mockPlayerWidthCh }">
          <div
            v-for="p in otherPlayers"
            :key="p.id"
            class="mock-player"
            :class="{
              'mock-player-waiting': !playerHasPlayed(p.id),
              'mock-player-ready': playerHasPlayed(p.id),
            }"
          >
            <span class="mock-name">{{ p.name }}</span>
            <div
              v-if="playerHasPlayed(p.id)"
              class="mock-card"
              :class="{ flipped: poker.isRevealed }"
            >
              <span class="ready-dot" v-if="!poker.isRevealed"></span>
              <div class="mock-card-face mock-card-back">?</div>
              <div class="mock-card-face mock-card-front">
                {{ getPlayerCard(p.id) === JOKER_VALUE ? '☕' : getPlayerCard(p.id) }}
              </div>
            </div>
            <div v-else class="mock-card mock-card-waiting">
              <span class="waiting-label">
                Waiting
                <br />
                ...
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Results modal -->
    <Teleport to="body">
      <div v-if="showRevealModal" class="modal-overlay" @click.self="() => {}">
        <div class="modal">
          <h2>Results</h2>
          <div v-if="poker.average !== null" class="modal-average">
            Average: <strong>{{ poker.average }}</strong>
          </div>
          <div v-else class="modal-average">No numeric cards played.</div>
          <div class="distribution">
            <h3>Distribution</h3>
            <div class="bar-chart">
              <div
                v-for="bar in scoreRows"
                :key="bar.value"
                class="bar-row"
              >
                <div class="bar-label">
                  <div class="bar-label-card">
                    <span class="bar-label-value">{{ bar.value }}</span>
                  </div>
                </div>
                <div class="bar-right">
                  <div class="bar-track">
                    <div
                      class="bar-fill"
                      :style="{ width: bar.widthPercent + '%' }"
                    >
                      <span v-if="bar.count > 0" class="bar-count">{{ bar.count }}</span>
                    </div>
                  </div>
                  <div v-if="bar.names.length" class="bar-names">
                    <span
                      v-for="name in bar.names"
                      :key="name"
                      class="bar-name"
                    >
                      {{ name }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <button class="btn btn-primary" @click="reset">New vote</button>
        </div>
      </div>
    </Teleport>

    <footer class="app-footer">
      Created by <span>Data-Fullstack</span>
    </footer>
  </div>
</template>

<style scoped>
.poker-page {
  min-height: 100vh;
  background: radial-gradient(circle at top, #1e293b 0%, #020617 55%, #000000 100%);
  padding: 1.5rem;
  color: #e5e7eb;
  position: relative;
}

.page-title {
  text-align: center;
  width: 100%;
  margin: 0 0 1rem 0;
  padding: 0;
  color: #f8fafc;
  font-size: 1.5rem;
  font-weight: 600;
}

.app-footer {
  position: fixed;
  inset-inline: 0;
  bottom: 0;
  padding: 0.75rem 1rem 0.85rem;
  text-align: center;
  font-size: 0.7rem;
  color: #64748b;
  border-top: 1px solid rgba(148, 163, 184, 0.25);
  background: rgba(2, 6, 23, 0.6);
}

.app-footer span {
  font-weight: 600;
}

.poker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.players-list-wrap {
  min-width: 160px;
  padding: 0.75rem 0.85rem;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.45);
  background: radial-gradient(circle at top left, rgba(51, 65, 85, 0.6), rgba(15, 23, 42, 0.9));
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.85);
}

.players-list-title {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: #9ca3af;
  margin-bottom: 0.45rem;
}

.players-list-wrap :deep(.players-list) {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

:deep(.player-row) {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.18rem 0.45rem;
  border-radius: 6px;
  font-size: 0.85rem;
}

:deep(.player-row-waiting) {
  background: rgba(251, 191, 36, 0.22);
  border: 1px solid rgba(251, 191, 36, 0.65);
  box-shadow: 0 0 12px rgba(251, 191, 36, 0.15);
}

:deep(.player-row-ready) {
  background: rgba(34, 197, 94, 0.22);
  border: 1px solid rgba(34, 197, 94, 0.6);
  box-shadow: 0 0 12px rgba(34, 197, 94, 0.15);
}

:deep(.player-icon) {
  font-size: 0.95rem;
  flex-shrink: 0;
}

:deep(.player-name) {
  color: #e5e7eb;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

:deep(.state-pill) {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.08rem 0.4rem;
  border-radius: 999px;
  font-size: 0.65rem;
  letter-spacing: 0.03em;
  flex-shrink: 0;
}

:deep(.state-pill-waiting) {
  background: rgba(251, 191, 36, 0.35);
  color: #fde047;
  font-weight: 600;
  border: 1px solid rgba(251, 191, 36, 0.5);
}

:deep(.state-pill-ready) {
  background: rgba(34, 197, 94, 0.35);
  color: #86efac;
  font-weight: 600;
  border: 1px solid rgba(34, 197, 94, 0.5);
}

.state-pill-revealed {
  background: rgba(59, 130, 246, 0.16);
  color: #60a5fa;
}

.session-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.session-pill {
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.6);
  font-size: 0.75rem;
  color: #e5e7eb;
}

.session-pill-clickable {
  cursor: pointer;
}

.session-pill-clickable:hover {
  background: rgba(30, 41, 59, 0.95);
  border-color: rgba(148, 163, 184, 0.8);
}

.btn-share {
  padding: 0.4rem 0.8rem;
  font-size: 0.8rem;
  background: rgba(15, 23, 42, 0.9);
  color: #e5e7eb;
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.6);
}

.btn-share:hover {
  background: rgba(30, 41, 59, 0.95);
  border-color: rgba(148, 163, 184, 0.8);
}

.btn-exit {
  padding: 0.4rem 0.8rem;
  font-size: 0.8rem;
  background: rgba(51, 65, 85, 0.9);
  color: #e5e7eb;
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.5);
}

.btn-exit:hover {
  background: rgba(71, 85, 105, 0.95);
  border-color: rgba(248, 113, 113, 0.5);
  color: #fca5a5;
}

.center-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  min-height: 145px;
  width: 100%;
}

.hint-and-waiting {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
}

.hint-text {
  margin: 0;
  font-size: 0.9rem;
  color: rgba(248, 250, 252, 0.85);
}

.waiting-for-you-slot {
  min-height: 3.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.waiting-for-you {
  padding: 0.85rem 1.6rem;
  border-radius: 999px;
  background: radial-gradient(circle at 30% 0%, rgba(15, 23, 42, 0.95), rgba(15, 23, 42, 0.85));
  box-shadow:
    0 0 0 1px rgba(148, 163, 184, 0.7),
    0 0 26px rgba(56, 189, 248, 0.75);
  font-size: 0.95rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #e0f2fe;
  text-align: center;
  margin: 0;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.9rem;
}

.btn-reset {
  background: #334155;
  color: #f8fafc;
}

.btn-reset:hover {
  background: #475569;
}

.table {
  position: relative;
  background:
    radial-gradient(circle at 20% 0%, rgba(255, 255, 255, 0.18), transparent 55%),
    radial-gradient(circle at 80% 100%, rgba(15, 23, 42, 0.65), transparent 55%),
    linear-gradient(180deg, var(--color-felt) 0%, #065f46 50%, #022c22 100%);
  border-radius: 12px;
  padding: 2.5rem 3rem;
  min-height: 420px;
  box-shadow:
    inset 0 0 80px rgba(0, 0, 0, 0.55),
    0 28px 60px rgba(0, 0, 0, 0.65);
  border: 10px solid #4b2b12;
  max-width: 100%;
  overflow: visible;
}

.table::before {
  content: '';
  position: absolute;
  inset: 14px;
  border-radius: inherit;
  border: 2px solid rgba(248, 250, 252, 0.06);
  box-shadow:
    0 0 0 1px rgba(15, 23, 42, 0.5),
    inset 0 0 30px rgba(15, 23, 42, 0.7);
  pointer-events: none;
}

.table-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  position: relative;
  min-width: 0;
  width: 100%;
}

.hand {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: center;
  margin-bottom: 0.5rem;
  max-width: 100%;
  padding-inline: 0.25rem;
}

.card-btn {
  position: relative;
  width: 60px;
  height: 88px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
}

.card-btn-hand {
  border-radius: 12px;
  background: linear-gradient(145deg, #f9fafb, #e5e7eb);
  box-shadow:
    0 10px 20px rgba(15, 23, 42, 0.45),
    0 0 0 1px rgba(148, 163, 184, 0.6);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #0f172a;
  overflow: hidden;
  transform-origin: center bottom;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.card-btn-hand:hover {
  transform: translateY(-4px) rotateZ(-2deg);
  box-shadow:
    0 18px 30px rgba(15, 23, 42, 0.7),
    0 0 0 1px rgba(148, 163, 184, 0.8);
}

.card-btn-hand:active {
  transform: translateY(-1px) rotateZ(-1deg);
}

.card-btn:disabled,
.card-btn:disabled:hover {
  cursor: default;
  transform: none;
  box-shadow:
    0 8px 18px rgba(15, 23, 42, 0.45),
    0 0 0 1px rgba(148, 163, 184, 0.6);
}

.card-label {
  position: absolute;
  font-size: 0.65rem;
  opacity: 0.8;
}

.card-label-top {
  top: 6px;
  left: 8px;
}

.card-label-bottom {
  bottom: 6px;
  right: 8px;
  transform: rotate(180deg);
}

.card-value-main {
  font-size: 1.4rem;
  font-weight: 700;
}

.card-picked {
  cursor: default;
  background: rgba(15, 23, 42, 0.9);
  box-shadow:
    inset 0 2px 8px rgba(0, 0, 0, 0.5),
    0 4px 12px rgba(0, 0, 0, 0.45);
  border: 2px solid rgba(148, 163, 184, 0.7);
  color: #e5e7eb;
  pointer-events: none;
}

.card-picked-value {
  opacity: 0.9;
}


.center-card-wrapper {
  perspective: 300px;
}

.center-card {
  width: 64px;
  height: 88px;
  position: relative;
  transform-style: preserve-3d;
  transition: transform 0.5s ease;
}

.center-card.flipped {
  transform: rotateY(180deg);
}

.center-card-face {
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1.25rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.center-card-back {
  background: radial-gradient(circle at 30% 0%, #1e3a8a, #020617 60%);
  color: #e5e7eb;
  border: 1px solid rgba(148, 163, 184, 0.7);
}

.center-card-front {
  background: radial-gradient(circle at 30% 0%, #fefce8, #e4e4e7 60%);
  color: #111827;
  border: 1px solid rgba(148, 163, 184, 0.9);
  transform: rotateY(180deg);
}

.btn-reveal {
  background: var(--color-accent);
  color: #1a1a2e;
}

.btn-reveal:hover {
  background: #d4af37;
}

.btn-reveal-ready {
  box-shadow:
    0 0 0 1px rgba(250, 250, 249, 0.4),
    0 0 22px rgba(250, 250, 249, 0.8);
  animation: reveal-pulse 1.1s infinite ease-in-out;
}

@keyframes reveal-pulse {
  0% {
    transform: scale(1);
    box-shadow:
      0 0 0 0 rgba(250, 250, 249, 0.7),
      0 0 16px rgba(250, 250, 249, 0.4);
  }
  70% {
    transform: scale(1.05);
    box-shadow:
      0 0 0 10px rgba(250, 250, 249, 0),
      0 0 28px rgba(250, 250, 249, 0.7);
  }
  100% {
    transform: scale(1.02);
    box-shadow:
      0 0 0 0 rgba(250, 250, 249, 0),
      0 0 12px rgba(250, 250, 249, 0.4);
  }
}

.mock-players {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: center;
  width: 100%;
}

.mock-player {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  gap: 0.1rem;
  padding: 0.2rem 0.3rem;
  border-radius: 8px;
  transition: background 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
}

.mock-player-waiting {
  background: rgba(251, 191, 36, 0.12);
  border: 1px solid rgba(251, 191, 36, 0.5);
  box-shadow: 0 0 16px rgba(251, 191, 36, 0.2);
}

.mock-player-ready {
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.45);
  box-shadow: 0 0 14px rgba(34, 197, 94, 0.18);
}

.mock-name {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.8);
  max-width: 12ch;
  display: block;
  text-align: center;
  overflow-wrap: break-word;
  word-break: normal;
  line-height: 1.2;
  padding: 0;
}

.mock-card {
  width: 44px;
  height: 60px;
  position: relative;
  transform-style: preserve-3d;
  transition: transform 0.5s ease;
}

.mock-card.flipped {
  transform: rotateY(180deg);
}

.mock-card-waiting {
  background: rgba(251, 191, 36, 0.08);
  border: 2px dashed rgba(251, 191, 36, 0.6);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 10px rgba(251, 191, 36, 0.15);
}

.waiting-label {
  font-size: 0.6rem;
  color: #fde047;
  font-weight: 600;
  text-align: center;
  line-height: 1.1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.ready-dot {
  position: absolute;
  top: 4px;
  right: 6px;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #22c55e;
  box-shadow: 0 0 10px rgba(34, 197, 94, 0.9);
}

.mock-card-face {
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.85rem;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.mock-card-back {
  background: radial-gradient(circle at 30% 0%, #1e3a8a, #020617 60%);
  color: #e5e7eb;
}

.mock-card-front {
  background: radial-gradient(circle at 30% 0%, #fefce8, #e4e4e7 60%);
  color: #111827;
  transform: rotateY(180deg);
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: radial-gradient(circle at top, rgba(15, 23, 42, 0.9), rgba(2, 6, 23, 0.98) 55%, rgba(0, 0, 0, 0.95) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 1rem;
  backdrop-filter: blur(6px);
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal {
  background:
    radial-gradient(circle at 20% 0%, rgba(148, 163, 184, 0.18), transparent 55%),
    radial-gradient(circle at 80% 100%, rgba(15, 23, 42, 0.8), transparent 55%),
    radial-gradient(ellipse 120% 120% at 50% 40%, var(--color-felt) 0%, #065f46 45%, #022c22 100%);
  border-radius: 16px;
  padding: 1.75rem 1.75rem 1.5rem;
  max-width: 400px;
  width: 100%;
  border: 1px solid rgba(148, 163, 184, 0.6);
  box-shadow:
    0 24px 80px rgba(0, 0, 0, 0.75),
    0 0 0 1px rgba(15, 23, 42, 0.9);
  display: flex;
  flex-direction: column;
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal h2 {
  margin-bottom: 1rem;
  color: #e5e7eb;
  font-size: 1.3rem;
  text-align: center;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.modal h2::after {
  content: '';
  display: block;
  width: 64px;
  height: 2px;
  margin: 0.6rem auto 0;
  border-radius: 999px;
  background: linear-gradient(90deg, #22c55e, #eab308);
}

.modal-average {
  margin-bottom: 1rem;
  color: #cbd5f5;
  text-align: center;
}

.modal-average strong {
  color: #bbf7d0;
  font-size: 1.3rem;
}

.distribution h3 {
  font-size: 0.9rem;
  color: #e5e7eb;
  margin-bottom: 0.75rem;
  text-align: left;
}

.bar-chart {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-bottom: 1rem;
}

.bar-row {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.bar-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.bar-label {
  flex-shrink: 0;
  width: 2.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bar-label-card {
  width: 100%;
  padding: 0.08rem 0;
  border-radius: 6px;
  background: linear-gradient(145deg, #f9fafb, #e5e7eb);
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.25),
    0 0 0 1px rgba(148, 163, 184, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
}

.bar-label-value {
  font-weight: 700;
  font-size: 0.85rem;
  color: #0f172a;
}

.bar-track {
  flex: 1;
  height: 1.4rem;
  background: rgba(15, 23, 42, 0.85);
  border-radius: 6px;
  border: 1px solid rgba(148, 163, 184, 0.8);
  overflow: hidden;
  min-width: 0;
}

.bar-fill {
  height: 100%;
  min-width: 0;
  border-radius: 6px;
  background: linear-gradient(90deg, #22c55e, #a3e635);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 0.3rem;
  transition: width 0.35s ease;
}

.bar-count {
  font-size: 0.75rem;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.3);
}

.bar-names {
  margin-top: 0.15rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.bar-name {
  font-size: 0.7rem;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  background: #e2e8f0;
  color: #0f172a;
}

@media (max-width: 1024px) {
  .poker-page {
    padding: 1.25rem 1rem;
  }

  .poker-header {
    align-items: flex-start;
  }

  .table {
    padding: 2rem 1.75rem;
  }
}

@media (max-width: 768px) {
  .poker-page {
    padding: 1rem 0.75rem 2.5rem;
  }

  .poker-header {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }

  .players-list-wrap {
    width: 100%;
    order: 2;
  }

  .page-title {
    font-size: 1.25rem;
  }

  .session-actions {
    position: static;
    justify-content: center;
    margin-bottom: 0.25rem;
  }

  .table {
    padding: 1.75rem 1.25rem;
    min-height: 360px;
  }

  .hand {
    gap: 0.5rem;
  }

  .card-btn {
    width: 50px;
    height: 74px;
  }

  .center-block {
    min-height: 136px;
  }

  .center-card {
    width: 56px;
    height: 80px;
  }

  .mock-card {
    width: 40px;
    height: 56px;
  }

  .modal {
    max-width: 90vw;
  }
}

@media (max-width: 600px) {
  .table {
    padding: 1.5rem 1rem;
  }

  .hand {
    gap: 0.45rem;
  }

  .card-btn {
    width: 44px;
    height: 62px;
  }

  .card-value-main {
    font-size: 1.15rem;
  }

  .center-block {
    min-height: 126px;
  }

  .center-card {
    width: 50px;
    height: 70px;
  }

  .mock-card {
    width: 36px;
    height: 50px;
  }
}

@media (max-width: 480px) {
  .poker-page {
    padding-inline: 0.5rem;
  }

  .page-title {
    font-size: 1.1rem;
  }

  .players-list-wrap :deep(.players-list) {
    font-size: 0.8rem;
  }

  .table {
    padding: 1.25rem 0.75rem;
    border-width: 8px;
    min-height: 320px;
  }

  .hand {
    gap: 0.35rem;
  }

  .card-btn {
    width: 38px;
    height: 54px;
  }

  .card-label-top,
  .card-label-bottom {
    font-size: 0.5rem;
  }

  .card-value-main {
    font-size: 0.95rem;
  }

  .center-block {
    min-height: 116px;
  }

  .center-card {
    width: 42px;
    height: 60px;
  }

  .mock-card {
    width: 32px;
    height: 44px;
  }

  .app-footer {
    font-size: 0.7rem;
    bottom: 0.5rem;
  }
}

.modal .btn-primary {
  align-self: center;
  width: auto;
  padding: 0.5rem 1rem;
  background: var(--color-accent);
  color: #1a1a2e;
  border-radius: 8px;
  font-size: 0.85rem;
  margin-top: 0.25rem;
}

.modal .btn-primary:hover {
  background: #d4af37;
}
</style>
