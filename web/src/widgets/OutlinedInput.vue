<script setup lang="ts">
/**
 * M3 outlined text field with a floating label. The peer/scale floating-label
 * mechanics are preserved (they work); only the color and shape tokens changed:
 * border/label use outline / on-surface-variant, focus uses primary.
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
      class="peer box-border block w-full appearance-none rounded-xs border bg-transparent px-3 pt-4 pb-1 text-sm text-on-surface outline-none transition-colors duration-short ease-standard border-outline focus:border-2 focus:border-primary focus:px-[11px] focus:pt-[15px] placeholder-shown:pt-3.5 placeholder-shown:pb-2.5"
    />
    <label
      class="pointer-events-none absolute left-2 top-3.5 origin-[0] bg-surface px-1 text-sm text-on-surface-variant transition-all duration-short ease-standard peer-focus:left-1 peer-focus:top-0 peer-focus:scale-75 peer-focus:text-primary peer-not-placeholder-shown:top-0 peer-not-placeholder-shown:scale-75 peer-not-placeholder-shown:text-primary"
      >{{ label }}</label
    >
  </div>
</template>
