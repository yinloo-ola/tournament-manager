<script setup lang="ts">
import {
  calculatorGroups,
  getEmptyPlayer,
  getGroup,
  removePlayerFromAllGroups
} from '@/calculator/groups_calculator'
import type { Category, Player } from '@/types/types'
import { computed, onMounted, ref } from 'vue'
import SimpleButton from '../widgets/SimpleButton.vue'
import PlayersChooser from './PlayersChooser.vue'
import { getPlayerDisplay } from '@/calculator/player_display'
import { doDraw } from '@/calculator/draw'

let groups = ref<Array<Array<Player>>>([])
onMounted(() => {
  const { numGroupsMain, numGroupsRemainder } = calculatorGroups(
    props.category.players.length,
    props.category.playersPerGrpMain,
    props.category.playersPerGrpRemainder
  )

  if (props.category.playersPerGrpMain > props.category.playersPerGrpRemainder) {
    for (let i = 0; i < numGroupsRemainder; i++) {
      groups.value.push(getGroup(props.category.playersPerGrpRemainder))
    }
    for (let i = 0; i < numGroupsMain; i++) {
      groups.value.push(getGroup(props.category.playersPerGrpMain))
    }
  } else {
    for (let i = 0; i < numGroupsMain; i++) {
      groups.value.push(getGroup(props.category.playersPerGrpMain))
    }
    for (let i = 0; i < numGroupsRemainder; i++) {
      groups.value.push(getGroup(props.category.playersPerGrpRemainder))
    }
  }
})

const props = defineProps<{ category: Category }>()
const emit = defineEmits(['close'])
let players = computed(() => {
  return props.category.players.map(getPlayerDisplay)
})

let isChoosingPlayer = ref(false)
let grpOnChoosing: number = -1
let posOnChoosing: number = -1
let chosenPlayersIndices = ref<{ [key: number]: boolean }>({})
function choosePlayer(grp: number, pos: number) {
  grpOnChoosing = grp
  posOnChoosing = pos
  isChoosingPlayer.value = true
}
function unselectPlayer(grp: number, pos: number) {
  const i = props.category.players.indexOf(groups.value[grp][pos])
  chosenPlayersIndices.value[i] = false
  groups.value[grp][pos] = getEmptyPlayer()
}
function playerChosen(playerIdx: number) {
  unselectPlayer(grpOnChoosing, posOnChoosing)
  removePlayerFromAllGroups(groups.value, props.category.players[playerIdx])
  chosenPlayersIndices.value[playerIdx] = true
  groups.value[grpOnChoosing][posOnChoosing] = props.category.players[playerIdx]
  grpOnChoosing = -1
  posOnChoosing = -1
  isChoosingPlayer.value = false
}
function autoDraw() {
  const ok = confirm('Auto draw will overwrite existing players. Continue?')
  if (!ok) return
  const seededPlayers = props.category.players.filter(
    (player) => player.seeding && player.seeding > 0
  )
  const otherPlayers = props.category.players.filter((player) => !player.seeding)
  if (seededPlayers.length + otherPlayers.length !== props.category.players.length) {
    alert("Something's wrong. Please check player list")
  }
  doDraw(groups.value, seededPlayers, otherPlayers)
}
</script>

<template>
  <div class="relative w-full h-full overflow-y-auto rounded-xl">
    <div class="outline-none border-solid border-0 flex justify-between h-12 bg-blue-300">
      <div class="flex flex-col justify-center px-4 font-black">Draw for {{ category?.name }}</div>
      <div class="flex flex-col justify-center pr-14">
        <SimpleButton class="bg-blue-700 text-white px-5" @click="autoDraw">AUTO DRAW</SimpleButton>
      </div>
      <div @click="emit('close')" class="i-line-md-close absolute right-3 top-3 cursor-pointer" />
    </div>
    <div class="h-full flex flex-row">
      <div
        class="w-64 flex flex-col pb-2 border-solid border-0 border-r overflow-y-auto bg-blue-100"
      >
        <div class="p-3 font-black border-solid border-0 bg-blue-200">Players</div>
        <div
          class="py-1 mx-3 border-solid border-0 border-b border-blue-200 decoration-blue-700 decoration-2"
          :class="{
            'line-through': chosenPlayersIndices[i]
          }"
          v-for="(player, i) in players"
        >
          {{ player }}
        </div>
      </div>
      <div
        class="w-full grid gap-4 p-4 xl:grid-cols-4 lg:grid-cols-3 md:grid-cols-2 sm:grid-cols-1 overflow-y-auto bg-blue-200"
      >
        <div
          v-for="(grp, i) in groups"
          class="flex flex-col border-solid border border-blue-200 bg-blue-100 shadow-sm hover:shadow-md rounded p-2"
        >
          <div class="py-2">Group {{ i + 1 }}</div>
          <div v-for="(playerInGrp, j) in grp" class="py-3 flex items-center">
            <div @click="choosePlayer(i, j)" class="i-line-md-edit cursor-pointer px-2" />
            <span> {{ j + 1 }}.</span>
            <span class="px-2">{{ getPlayerDisplay(playerInGrp) }}</span>
            <div
              v-if="playerInGrp.name.length > 0"
              @click="unselectPlayer(i, j)"
              class="i-line-md-account-delete cursor-pointer px-2"
            />
          </div>
        </div>
      </div>
    </div>

    <div v-if="isChoosingPlayer" class="fixed top-6 bottom-6 w-full flex justify-center">
      <PlayersChooser
        :players="category.players"
        @close="isChoosingPlayer = false"
        @player-chosen="playerChosen"
      ></PlayersChooser>
    </div>
  </div>
</template>
