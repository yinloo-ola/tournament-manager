<script setup lang="ts">
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'

defineOptions({ name: 'ModalDialog' })

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true
  },
  contentClass: {
    type: String,
    default: ''
  },
  showCloseButton: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

// Focus trap: capture the element focused before opening, move focus into the
// dialog on open, keep Tab cycling inside it, and restore focus on close.
const dialogRef = ref<HTMLElement | null>(null)
let lastFocused: HTMLElement | null = null

function close() {
  emit('update:modelValue', false)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.modelValue) {
    e.preventDefault()
    close()
    return
  }
  if (e.key === 'Tab' && props.modelValue && dialogRef.value) {
    const focusable = dialogRef.value.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }
}

watch(
  () => props.modelValue,
  async (open) => {
    if (open) {
      lastFocused = document.activeElement as HTMLElement
      document.addEventListener('keydown', onKeydown)
      await nextTick()
      // Focus the dialog container (or first focusable) — never the scrim.
      const target =
        dialogRef.value?.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ) ?? dialogRef.value
      target?.focus()
    } else {
      document.removeEventListener('keydown', onKeydown)
      lastFocused?.focus()
      lastFocused = null
    }
  }
)

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Transition name="md-dialog">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4"
      @click.self="close"
    >
      <div
        ref="dialogRef"
        tabindex="-1"
        role="dialog"
        aria-modal="true"
        class="md-dialog-surface relative m-4 max-h-[90vh] overflow-auto rounded-xl border-none bg-surface-container-high text-on-surface elevation-3 outline-none"
        :class="contentClass"
      >
        <button
          v-if="showCloseButton"
          @click="close"
          aria-label="Close dialog"
          class="absolute right-3 top-3 z-10 h-9 w-9 flex items-center justify-center rounded-full border-none bg-transparent text-on-surface-variant transition-colors duration-short ease-standard hover:bg-surface-container-highest hover:text-on-surface focus:bg-surface-container-highest focus:outline focus:outline-2 focus:outline-primary active:scale-95"
        >
          <div class="i-line-md-close h-5 w-5"></div>
        </button>
        <slot></slot>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* M3 dialog motion: scale + fade with emphasized easing (not the old bounce). */
.md-dialog-enter-active,
.md-dialog-leave-active {
  transition:
    opacity var(--md-duration-short) var(--md-easing-standard),
    transform var(--md-duration-medium) var(--md-easing-emphasized);
}
.md-dialog-enter-from,
.md-dialog-leave-to {
  opacity: 0;
}
.md-dialog-enter-from .md-dialog-surface,
.md-dialog-leave-to .md-dialog-surface {
  /* scale the dialog surface, not the scrim */
  transform: scale(0.85);
}

/* Scrim token (M3 uses a translucent neutral); defined locally since it's a
   one-off composite, not worth a theme color. */
.bg-scrim {
  background-color: rgba(0, 0, 0, 0.32);
}
</style>
