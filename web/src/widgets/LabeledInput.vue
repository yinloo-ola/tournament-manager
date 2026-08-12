<script setup lang="ts">
/**
 * M3 filled text field — the underline style. Border-bottom instead of full
 * border; label floats on focus/value.
 *
 * box-border makes w-full + px-3 stay inside the parent (without it, the
 * content-box default makes the input 100% + 24px and it overflows the card).
 * px-3 / left-2 match OutlinedInput so typed text is indented consistently
 * across both field styles. readonly fields are dimmed (outline-variant border,
 * muted text + label) and don't flash primary on focus.
 */
// `readonly` is typed Boolean so a bare `readonly` attribute (no value) in a
// parent template resolves to true; with the array form it'd be "" (falsy) and
// the dimmed readonly branch below would never apply.
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
        'peer block w-full box-border appearance-none border-0 border-b bg-transparent px-3 pt-4 pb-1 text-sm outline-none transition-colors duration-short ease-standard placeholder-shown:pt-3.5 placeholder-shown:pb-2.5',
        readonly
          ? 'border-outline-variant text-on-surface-variant'
          : 'border-outline text-on-surface focus:border-b-2 focus:border-primary'
      ]"
    />
    <label
      :class="[
        'pointer-events-none absolute left-2 top-3.5 origin-[0] bg-transparent px-1 text-sm text-on-surface-variant transition-all duration-short ease-standard peer-focus:top-0 peer-focus:scale-75 peer-not-placeholder-shown:top-0 peer-not-placeholder-shown:scale-75',
        readonly ? '' : 'peer-focus:text-primary peer-not-placeholder-shown:text-primary'
      ]"
      >{{ label }}</label
    >
  </div>
</template>
