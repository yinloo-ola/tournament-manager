<script setup lang="ts">
/**
 * M3 outlined text field with a floating label. The peer/scale floating-label
 * mechanics are preserved (they work); only the color and shape tokens changed:
 * border/label use outline / on-surface-variant, focus uses primary.
 *
 * On focus the border thickens 1px→2px; focus:px-[11px]/focus:pt-[15px] nudge
 * the content by 1px so the typed text stays put. The label holds a constant
 * left-2 (no peer-focus:left-*) so it does NOT jump horizontally on focus.
 * readonly fields use a dimmed outline-variant border + muted text/label and
 * skip the focus thickening.
 *
 * Border style is `solid` via the global reset in base.css (not per-widget):
 * without it, the UA default `border-style: inset` on <input> bevels the
 * focused border into a blue-and-dark edge (the "blue and black" bug).
 */
defineProps<{
  label?: string
  type?: string
  name?: string
  readonly?: boolean
}>()
const model = defineModel()
</script>

<template>
  <div class="relative mt-4 min-w-0">
    <input
      :type
      :name
      :readonly
      v-model="model"
      placeholder=" "
      :class="[
        'peer box-border block w-full appearance-none rounded-xs border bg-transparent px-3 pt-4 pb-1 text-sm outline-none transition-colors duration-short ease-standard placeholder-shown:pt-3.5 placeholder-shown:pb-2.5',
        readonly
          ? 'border-outline-variant text-on-surface-variant'
          : 'border-outline text-on-surface focus:border-2 focus:border-primary focus:px-[11px] focus:pt-[15px]'
      ]"
    />
    <label
      :class="[
        'pointer-events-none absolute left-2 top-3.5 origin-[0] bg-surface px-1 text-sm text-on-surface-variant transition-all duration-short ease-standard peer-focus:top-0 peer-focus:scale-75 peer-not-placeholder-shown:top-0 peer-not-placeholder-shown:scale-75',
        readonly ? '' : 'peer-focus:text-primary peer-not-placeholder-shown:text-primary'
      ]"
      >{{ label }}</label
    >
  </div>
</template>
