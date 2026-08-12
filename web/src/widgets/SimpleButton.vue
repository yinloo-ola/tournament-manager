<script setup lang="ts">
/**
 * M3 button. Variant selects the M3 button style:
 *   - filled    (primary surface, prominent action — default)
 *   - tonal     (secondary surface, lower emphasis)
 *   - text      (no surface, lowest emphasis)
 *
 * State and Outlined variants live in OutlinedButton. The old ad-hoc color
 * classes (bg-blue-600, bg-lime-700, …) that callers used to pass via `class`
 * are replaced by `variant`; the only thing a caller should style now is
 * sizing/layout.
 */
withDefaults(
  defineProps<{
    variant?: 'filled' | 'tonal' | 'text'
    disabled?: boolean
  }>(),
  {
    variant: 'filled',
    disabled: false
  }
)
</script>

<template>
  <button
    :disabled="disabled"
    :class="[
      'inline-flex items-center justify-center gap-2 rounded-full px-6 h-10 text-sm font-medium tracking-[0.1px] transition-all duration-short ease-standard select-none outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
      variant === 'filled' &&
        'bg-primary text-on-primary hover:elevation-1 focus:elevation-1 active:elevation-0 disabled:bg-on-surface/12 disabled:text-on-surface/38',
      variant === 'tonal' &&
        'bg-primary-container text-on-primary-container hover:elevation-1 focus:elevation-1 active:elevation-0 disabled:bg-on-surface/12 disabled:text-on-surface/38',
      variant === 'text' &&
        'bg-transparent text-primary hover:bg-primary/8 focus:bg-primary/8 active:bg-primary/12 px-3 disabled:text-on-surface/38',
      'disabled:cursor-not-allowed disabled:elevation-0',
      !disabled && 'cursor-pointer active:scale-[.97]'
    ]"
  >
    <slot></slot>
  </button>
</template>
