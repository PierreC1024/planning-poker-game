<script setup>
const props = defineProps({
  sessionId: {
    type: String,
    required: true,
  },
  idCopyFeedback: {
    type: Boolean,
    required: true,
  },
  linkCopyFeedback: {
    type: Boolean,
    required: true,
  },
})

const emit = defineEmits(['copy-id', 'copy-link'])

function handleCopyId() {
  emit('copy-id')
}

function handleCopyLink() {
  emit('copy-link')
}
</script>

<template>
  <div class="session-actions">
    <button
      type="button"
      class="session-pill session-pill-clickable"
      :title="idCopyFeedback ? 'Copied!' : 'Click to copy session ID'"
      @click="handleCopyId"
    >
      {{ idCopyFeedback ? 'Copied!' : `Session: ${sessionId}` }}
    </button>
    <button
      type="button"
      class="btn btn-share"
      :title="linkCopyFeedback ? 'Copied!' : 'Copy session link'"
      @click="handleCopyLink"
    >
      {{ linkCopyFeedback ? 'Copied' : 'Share' }}
    </button>
  </div>
</template>

