<script setup lang="ts">
/**
 * M3 filled text field — the underline style. Border-bottom instead of full
 * border; label floats on focus/value. Kept the working peer mechanics, only
 * swapped hardcoded grays/blues for tokens.
 */
defineProps(['label', 'type', 'name', 'readonly'])
const model = defineModel()
</script>

<template>
  <div class="relative mt-4">
    <input
      :type
      :name
      :readonly
      v-model="model"
      placeholder=" "
      class="peer block w-full appearance-none border-0 border-b bg-transparent px-0 pt-4 pb-1 text-sm text-on-surface outline-none transition-colors duration-short ease-standard border-outline focus:border-2 focus:border-primary placeholder-shown:pt-3.5 placeholder-shown:pb-2.5"
    />
    <label
      class="pointer-events-none absolute left-0 top-3.5 origin-[0] bg-transparent px-1 text-sm text-on-surface-variant transition-all duration-short ease-standard peer-focus:top-0 peer-focus:scale-75 peer-focus:text-primary peer-not-placeholder-shown:top-0 peer-not-placeholder-shown:scale-75 peer-not-placeholder-shown:text-primary"
      >{{ label }}</label
    >
  </div>
</template>
