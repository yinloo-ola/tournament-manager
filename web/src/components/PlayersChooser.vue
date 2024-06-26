<script setup lang="ts">
import { getPlayerDisplay } from '@/calculator/player_display'
import type { Player } from '@/types/types'

const props = defineProps<{
  players: Array<Player>
}>()

const emit = defineEmits(['playerChosen', 'close'])
</script>

<template>
  <div
    class="relative flex flex-col bg-purple-200 rounded-xl border border-solid shadow-lg border-gray-300"
  >
    <div @click="emit('close')" class="i-line-md-close absolute right-3 top-3 cursor-pointer" />
    <div class="font-black py-2 px-3 border border-solid border-0">Choose a Player</div>
    <div class="flex flex-col px-3 overflow-y-auto bg-purple-100 rounded-b-xl">
      <div
        class="py-1 border border-solid border-0 border-b border-purple-200"
        v-for="(player, i) in players"
      >
        <div class="cursor-pointer py-2" @click="emit('playerChosen', i)">
          {{ getPlayerDisplay(player) }}
        </div>
      </div>
    </div>
  </div>
</template>
