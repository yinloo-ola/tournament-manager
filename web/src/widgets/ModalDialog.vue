<template>
  <Transition name="fade">
    <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      @click.self="$emit('update:modelValue', false)">
      <div class="relative m-4 overflow-auto border border-gray-300 rounded-xl border-solid shadow-xl"
        :class="contentClass || 'bg-white'">
        <button v-if="showCloseButton" @click="$emit('update:modelValue', false)"
          class="absolute right-2 top-2 z-10 rounded-full border-none p-1.5 text-gray-500 transition-all duration-200 active:scale-95 active:bg-gray-300 hover:bg-gray-200 hover:text-gray-700">
          <div class="i-line-md-close h-5 w-5"></div>
        </button>
        <slot></slot>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
defineOptions({
  name: 'ModalDialog'
});

defineProps({
  modelValue: {
    type: Boolean,
    required: true
  },
  contentClass: {
    type: String,
    default: ''
  },
  showCloseButton: {
    type: Boolean,
    default: true
  }
});

defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>();
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
