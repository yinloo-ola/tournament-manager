<script setup lang="ts">
// Make label optional only when divider is true
withDefaults(
  defineProps<{
    label?: string
    divider?: boolean
    wide?: boolean
  }>(),
  {
    divider: false,
    wide: false
  }
)

const emit = defineEmits<{
  (e: 'click'): void
}>()

function handleClick() {
  emit('click')
}
</script>

<template>
  <div
    v-if="divider"
    class="border-0 border-b border-outline-variant border-solid"
  ></div>
  <div
    v-else
    :class="[
      'cursor-pointer rounded-xs px-4 py-2.5 text-sm font-medium text-on-surface transition-colors duration-short ease-standard hover:bg-surface-container-high focus:bg-surface-container-high outline-none',
      { 'w-38': wide }
    ]"
    @click="handleClick"
  >
    {{ label }}
  </div>
</template>
