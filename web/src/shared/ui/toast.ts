import { ref, readonly } from 'vue'

// M3 snackbar host state — a module singleton. Module-level (not
// inject/provide) so any caller can show a toast without a component
// injection context, including handlers in deep components and (via the
// caller) domain boundaries. One SnackbarHost mounted in App.vue renders
// the queue; everyone else just calls `show()`.

export type ToastTone = 'info' | 'success' | 'error'

export interface ToastOptions {
  /** Semantic tone — recolors the snackbar (error container for errors, etc.). */
  tone?: ToastTone
  /** Optional single action button label (M3 allows at most one action). */
  actionLabel?: string
  /** Runs when the action button is clicked; the toast dismisses after. */
  onAction?: () => void
  /** Override the auto-dismiss delay (ms). Default 4000; 0 = sticky. */
  duration?: number
}

export interface Toast extends Required<Omit<ToastOptions, 'actionLabel' | 'onAction'>> {
  id: number
  message: string
  actionLabel?: string
  onAction?: () => void
}

const queue = ref<Toast[]>([])
let nextId = 0

function dismiss(id: number) {
  queue.value = queue.value.filter((t) => t.id !== id)
}

function show(message: string, options: ToastOptions = {}): number {
  const toast: Toast = {
    id: nextId++,
    message,
    tone: options.tone ?? 'info',
    actionLabel: options.actionLabel,
    onAction: options.onAction,
    duration: options.duration ?? 4000
  }
  queue.value = [...queue.value, toast]
  return toast.id
}

/** Convenience helpers for the common tones. */
const toast = {
  info: (message: string, options?: ToastOptions) => show(message, { ...options, tone: 'info' }),
  success: (message: string, options?: ToastOptions) =>
    show(message, { ...options, tone: 'success' }),
  error: (message: string, options?: ToastOptions) =>
    show(message, { ...options, tone: 'error' })
}

export function useToast() {
  return {
    queue: readonly(queue),
    show,
    dismiss,
    toast
  }
}
