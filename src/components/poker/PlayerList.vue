<script setup>
const props = defineProps({
  players: {
    type: Array,
    required: true,
  },
  currentPlayerId: {
    type: String,
    required: false,
  },
  selections: {
    type: Object,
    required: true,
  },
})

const isCurrentPlayer = (id) => props.currentPlayerId === id
const playerHasPlayed = (id) => props.selections[id] != null
</script>

<template>
  <div class="players-list">
    <div
      v-for="p in players"
      :key="p.id"
      class="player-row"
      :class="{
        'player-row-waiting': !playerHasPlayed(p.id),
        'player-row-ready': playerHasPlayed(p.id),
      }"
    >
      <span v-if="isCurrentPlayer(p.id)" class="player-icon">👤</span>
      <span class="player-name">{{ p.name }}</span>
      <span v-if="playerHasPlayed(p.id)" class="state-pill state-pill-ready"> Ready </span>
      <span v-else class="state-pill state-pill-waiting"> Waiting </span>
    </div>
  </div>
</template>
