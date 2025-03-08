<script setup lang="ts">
// Make label optional only when divider is true
withDefaults(defineProps<{
  label?: string;
  divider?: boolean;
  wide?: boolean;
}>(), {
  divider: false,
  wide: false
});

const emit = defineEmits<{
  (e: 'click'): void;
}>();

function handleClick() {
  emit('click');
}
</script>

<template>
  <div v-if="divider" class="border-0 border-b border-gray-400 border-solid"></div>
  <div v-else
    :class="[
      'cursor-pointer rounded-md px-4 py-2 hover:bg-lime-700 hover:text-white',
      { 'w-38': wide }
    ]"
    @click="handleClick">
    {{ label }}
  </div>
</template>
