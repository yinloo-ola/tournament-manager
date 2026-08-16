<script setup lang="ts">
import { watch, onBeforeUnmount } from 'vue'
import { useToast, type Toast } from '@/shared/ui/toast'

// Single M3 snackbar host. Mounted once in App.vue. M3 shows one snackbar at a
// time; when the queue holds more than one, only the head is visible and the
// rest advance as each dismisses.
const { queue, dismiss } = useToast()

// The head of the queue is the visible toast.
function current(): Toast | undefined {
  return queue.value[0]
}

let timer: ReturnType<typeof setTimeout> | undefined

// Auto-dismiss the head toast after its duration (unless sticky / duration 0).
watch(
  () => queue.value[0]?.id,
  (id) => {
    clearTimeout(timer)
    if (id === undefined) return
    const head = queue.value[0]
    if (head && head.duration > 0) {
      timer = setTimeout(() => dismiss(id), head.duration)
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => clearTimeout(timer))

// The action button runs its handler, then dismisses so the queue advances.
function runAction(toast: Toast) {
  toast.onAction?.()
  dismiss(toast.id)
}
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex flex-col items-center gap-2 px-4">
    <Transition name="md-snackbar">
      <div
        v-if="current()"
        :key="current()!.id"
        role="status"
        aria-live="polite"
        class="pointer-events-auto flex min-w-[280px] max-w-[560px] items-center gap-4 rounded-xs px-4 py-3.5 elevation-3"
        :class="
          current()!.tone === 'error'
            ? 'bg-error-container text-on-error-container'
            : 'bg-inverse-surface text-inverse-on-surface'
        "
      >
        <span class="body-medium flex-1">{{ current()!.message }}</span>
        <button
          v-if="current()!.actionLabel"
          @click="runAction(current()!)"
          class="label-large border-0 bg-transparent cursor-pointer outline-none focus-visible:underline"
          :class="
            current()!.tone === 'error'
              ? 'text-on-error-container'
              : 'text-inverse-primary'
          "
        >
          {{ current()!.actionLabel }}
        </button>
        <button
          v-else
          @click="dismiss(current()!.id)"
          aria-label="Dismiss"
          class="flex h-7 w-7 items-center justify-center rounded-full border-0 bg-transparent cursor-pointer opacity-70 outline-none transition-opacity hover:opacity-100"
          :class="
            current()!.tone === 'error'
              ? 'text-on-error-container'
              : 'text-inverse-on-surface'
          "
        >
          <span class="i-line-md-close"></span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* M3 snackbar motion: slide up + fade. */
.md-snackbar-enter-active,
.md-snackbar-leave-active {
  transition:
    opacity var(--md-duration-short) var(--md-easing-standard),
    transform var(--md-duration-medium) var(--md-easing-emphasized);
}
.md-snackbar-enter-from,
.md-snackbar-leave-to {
  opacity: 0;
  transform: translateY(16px);
}
</style>
