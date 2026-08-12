<script setup lang="ts">
// Make label optional only when divider is true
withDefaults(
  defineProps<{
    label?: string
    divider?: boolean
  }>(),
  {
    divider: false
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
  <!--
    No explicit width: the menu is `flex flex-col`, so each item stretches to
    fill the menu width (align-items: stretch). A fixed width here would leave
    items narrower than the menu (the `w-38`/`wide` bug).
    Hover/focus use an on-surface state layer (8/10/12%) rather than stepping
    one surface-container level — the surface tonal ramp is only ~5/255 apart,
    so a level step was near-invisible.
  -->
  <div
    v-else
    class="cursor-pointer rounded-xs px-4 py-2.5 text-sm font-medium text-on-surface transition-colors duration-short ease-standard hover:bg-on-surface/8 focus:bg-on-surface/10 active:bg-on-surface/12 outline-none"
    @click="handleClick"
  >
    {{ label }}
  </div>
</template>
