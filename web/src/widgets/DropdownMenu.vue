<script setup lang="ts">
import { ref, onMounted, onUnmounted, provide } from 'vue'

defineProps<{
  buttonClass?: string
  menuClass?: string
  buttonIcon?: string
}>()

const showMenu = ref(false)
const menuRef = ref<HTMLElement | null>(null)
const buttonRef = ref<HTMLElement | null>(null)

function toggleMenu() {
  showMenu.value = !showMenu.value
}

function closeMenu() {
  showMenu.value = false
}

// Close the menu when a menu item is clicked
function closeMenuOnItemClick(event: MouseEvent) {
  // Only close if the click is directly on a menu item, not on a divider
  if ((event.target as HTMLElement).classList.contains('cursor-pointer')) {
    setTimeout(() => {
      showMenu.value = false
    }, 100) // Small delay to allow the click event to complete
  }
}

// Provide the closeMenu function to child components
provide('closeMenu', closeMenu)

function handleClickOutside(event: MouseEvent) {
  if (
    showMenu.value &&
    menuRef.value &&
    buttonRef.value &&
    !menuRef.value.contains(event.target as Node) &&
    !buttonRef.value.contains(event.target as Node)
  ) {
    showMenu.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="relative">
    <button ref="buttonRef" @click="toggleMenu" :class="buttonClass">
      <slot name="button-content"></slot>
    </button>
    <Transition name="md-menu">
      <div
        v-if="showMenu"
        ref="menuRef"
        :class="
          menuClass ||
          'absolute right-0 z-50 mr-4 w-fit flex flex-col gap-1 rounded-sm bg-surface-container elevation-2 p-2'
        "
        @click="closeMenuOnItemClick"
      >
        <slot></slot>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* M3 menu motion: scale from the top-right origin (the anchor) + fade. */
.md-menu-enter-active,
.md-menu-leave-active {
  transition:
    opacity var(--md-duration-short) var(--md-easing-decelerated),
    transform var(--md-duration-short) var(--md-easing-decelerated);
  transform-origin: top right;
}
.md-menu-enter-from,
.md-menu-leave-to {
  opacity: 0;
  transform: scale(0.92);
}
</style>
