<script setup lang="ts">
import { getPlayerDisplay } from '@/calculator/player_display'
import type { Player } from '@/types/types'

const props = defineProps<{
  players: Array<Player>
}>()

const emit = defineEmits(['playerChosen'])
</script>

<template>
  <div class="flex flex-col bg-gray-200 rounded border border-solid">
    <div class="font-black py-2 px-3 border border-solid border-0 border-b">Choose a Player</div>
    <div class="flex flex-col px-3 overflow-y-auto">
      <div class="py-1 border border-solid border-0 border-b" v-for="(player, i) in players">
        <div class="cursor-pointer py-2">
          {{ getPlayerDisplay(player) }}
        </div>
      </div>
    </div>
  </div>
</template>
