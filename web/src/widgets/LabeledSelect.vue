<script setup lang="ts">
/**
 * M3 filled select — underline style matching LabeledInput. Label floats on
 * focus/value via the same peer mechanics. `appearance-none` strips the native
 * dropdown arrow, so a trailing chevron span is rendered as the affordance
 * (without it the select gives no visual cue it's a dropdown). box-border keeps
 * w-full + pl-3/pr-9 inside the parent; the extra right padding clears the
 * chevron. left-2 mirrors LabeledInput.
 */
defineProps<{
  label?: string
  name?: string
  options?: Array<{ value: string; label: string }>
  readonly?: boolean
}>()
const model = defineModel()
</script>

<template>
  <div class="relative mt-4 min-w-0">
    <select
      :name
      :readonly
      v-model="model"
      :class="[
        'peer block w-full box-border appearance-none border-0 border-b bg-transparent pl-3 pr-9 pt-4 pb-1 text-sm outline-none transition-colors duration-short ease-standard',
        readonly
          ? 'border-outline-variant text-on-surface-variant'
          : 'border-outline text-on-surface focus:border-b-2 focus:border-primary'
      ]"
    >
      <option v-for="option in options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
    <span
      class="i-line-md-chevron-small-down pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-on-surface-variant transition-colors duration-short ease-standard peer-focus:text-primary"
    ></span>
    <label
      :class="[
        'pointer-events-none absolute left-2 top-3.5 origin-[0] bg-transparent px-1 text-sm text-on-surface-variant transition-all duration-short ease-standard peer-focus:top-0 peer-focus:scale-75 peer-not-placeholder-shown:top-0 peer-not-placeholder-shown:scale-75',
        readonly ? '' : 'peer-focus:text-primary peer-not-placeholder-shown:text-primary'
      ]"
      >{{ label }}</label
    >
  </div>
</template>
