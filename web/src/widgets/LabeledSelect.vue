<script setup lang="ts">
/**
 * M3 filled select — underline style matching LabeledInput. Label floats on
 * focus/value via the same peer mechanics; dropdown chrome is native.
 */
defineProps(['label', 'name', 'options', 'readonly'])
const model = defineModel()
</script>

<template>
  <div class="relative mt-4">
    <select
      :name
      :readonly
      v-model="model"
      class="peer block w-full appearance-none border-0 border-b bg-transparent px-0 pt-4 pb-1 text-sm text-on-surface outline-none transition-colors duration-short ease-standard border-outline focus:border-2 focus:border-primary"
    >
      <option v-for="option in options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
    <label
      class="pointer-events-none absolute left-0 top-3.5 origin-[0] bg-transparent px-1 text-sm text-on-surface-variant transition-all duration-short ease-standard peer-focus:top-0 peer-focus:scale-75 peer-focus:text-primary peer-not-placeholder-shown:top-0 peer-not-placeholder-shown:scale-75 peer-not-placeholder-shown:text-primary"
      >{{ label }}</label
    >
  </div>
</template>
