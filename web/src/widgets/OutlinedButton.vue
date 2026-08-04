<script setup lang="ts">
/**
 * M3 outlined button. The outline is the affordance, so there is no fill.
 * `tone` recolors it for semantic intent:
 *   - primary (default) — outline/label in primary
 *   - error              — outline/label in error
 *
 * Replaces the old pattern where callers passed border/text colors via `class`
 * (border-blue-600, border-red-700). Only sizing/layout should be styled by
 * the caller now.
 */
withDefaults(
  defineProps<{
    tone?: 'primary' | 'error'
    disabled?: boolean
  }>(),
  {
    tone: 'primary',
    disabled: false
  }
)
</script>

<template>
  <button
    :disabled="disabled"
    :class="[
      'inline-flex items-center justify-center gap-2 rounded-full px-6 h-10 text-sm font-medium tracking-[0.1px] transition-all duration-short ease-standard select-none outline-none border',
      tone === 'primary' &&
        'border-outline text-primary hover:bg-primary/8 focus:bg-primary/8 active:bg-primary/12 disabled:border-on-surface/12 disabled:text-on-surface/38',
      tone === 'error' &&
        'border-error text-error hover:bg-error/8 focus:bg-error/8 active:bg-error/12 disabled:border-on-surface/12 disabled:text-on-surface/38',
      'disabled:cursor-not-allowed disabled:elevation-0',
      !disabled && 'cursor-pointer active:scale-[.97]'
    ]"
  >
    <slot></slot>
  </button>
</template>
