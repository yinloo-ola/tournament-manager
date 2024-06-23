<script setup lang="ts">
defineProps({
  disabled: Boolean
})
</script>

<template>
  <button
    :disabled
    :class="{
      'cursor-pointer active:scale-[.97] bg-transparent hover:border-transparent': !disabled,
      'cursor-not-allowed bg-gray-300 border-0 opacity-50': disabled
    }"
    class="border rounded-lg border-solid px-3 py-2 text-[15px] outline-0"
  >
    <slot></slot>
  </button>
</template>
