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
    class="relative flex flex-col border border-gray-300 rounded-xl border-solid bg-purple-200 shadow-lg"
  >
    <div @click="emit('close')" class="i-line-md-close absolute right-3 top-3 cursor-pointer" />
    <div class="border border-0 border-solid px-3 py-2 font-black">Choose a Player</div>
    <div class="flex flex-col overflow-y-auto rounded-b-xl bg-purple-100 px-3">
      <div
        class="border border-0 border-b border-purple-200 border-solid py-1"
        v-for="(player, i) in players"
        :key="i"
      >
        <div class="cursor-pointer py-2" @click="emit('playerChosen', i)">
          {{ getPlayerDisplay(player) }}
        </div>
      </div>
    </div>
  </div>
</template>
