<template>
  <button
    class="cursor-pointer border-0 rounded-lg px-3 py-2 text-[15px] shadow-gray-500/50 shadow-sm active:scale-[.97] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none hover:shadow-lg disabled:active:scale-100"
    :disabled="disabled"
  >
    <slot></slot>
  </button>
</template>

<script setup lang="ts">
defineProps({
  disabled: {
    type: Boolean,
    default: false
  }
})
</script>
