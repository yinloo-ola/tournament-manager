<script setup lang="ts">
import { getPlayerDisplay } from '@/calculator/player_display'
import type { Entry } from '@/types/types'

const props = defineProps<{
  players: Array<Entry>
}>()

const emit = defineEmits(['playerChosen', 'close'])
</script>

<template>
  <div
    class="relative flex flex-col rounded-lg border border-outline-variant bg-surface elevation-3"
  >
    <button
      @click="emit('close')"
      aria-label="Close"
      class="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border-0 bg-transparent text-on-surface-variant cursor-pointer transition-colors duration-short ease-standard hover:bg-surface-container-high hover:text-on-surface"
    >
      <span class="i-line-md-close"></span>
    </button>
    <div class="title-medium px-3 py-2 text-on-surface">Choose a Player</div>
    <div class="flex flex-col overflow-y-auto rounded-b-lg bg-surface-container-low px-3">
      <div
        class="border-b border-outline-variant py-1"
        v-for="(player, i) in players"
        :key="i"
      >
        <div
          class="body-medium cursor-pointer rounded-xs py-2 px-2 text-on-surface transition-colors duration-short ease-standard hover:bg-surface-container-high"
          @click="emit('playerChosen', i)"
        >
          {{ getPlayerDisplay(player) }}
        </div>
      </div>
    </div>
  </div>
</template>
