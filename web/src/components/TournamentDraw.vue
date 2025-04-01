<script setup lang="ts">
import {
  calculatorGroups,
  getGroup,
  isGroupEmpty,
  isPlayerChosen,
  removePlayerFromAllGroups
} from '@/calculator/groups'
import { EntryEmptyIdx, type Category, type Group } from '@/types/types'
import { computed, onMounted, ref } from 'vue'
import SimpleButton from '../widgets/SimpleButton.vue'
import PlayersChooser from './PlayersChooser.vue'
import { getPlayerDisplay } from '@/calculator/player_display'
import { clearDraw, doDraw } from '@/calculator/draw'
import OutlinedButton from '@/widgets/OutlinedButton.vue'

let groups = ref<Array<Group>>([])
onMounted(() => {
  if (props.category.groups.length > 0) {
    groups.value = [...props.category.groups]
    return
  }
  const { numGroupsMain, numGroupsRemainder } = calculatorGroups(
    props.category.entries.length,
    props.category.entriesPerGrpMain,
    props.category.entriesPerGrpRemainder
  )

  if (props.category.entriesPerGrpMain > props.category.entriesPerGrpRemainder) {
    for (let i = 0; i < numGroupsRemainder; i++) {
      groups.value.push(getGroup(props.category.entriesPerGrpRemainder))
    }
    for (let i = 0; i < numGroupsMain; i++) {
      groups.value.push(getGroup(props.category.entriesPerGrpMain))
    }
  } else {
    for (let i = 0; i < numGroupsMain; i++) {
      groups.value.push(getGroup(props.category.entriesPerGrpMain))
    }
    for (let i = 0; i < numGroupsRemainder; i++) {
      groups.value.push(getGroup(props.category.entriesPerGrpRemainder))
    }
  }
  emit('groups-updated', groups.value)
})

const props = defineProps<{ category: Category }>()
const emit = defineEmits(['groups-updated'])

let players = computed(() => {
  return props.category.entries.map(getPlayerDisplay)
})
let chosenPlayersIndices = computed<{ [key: number]: boolean }>(() => {
  let out: { [key: number]: boolean } = {}
  props.category.entries.forEach((_player, i) => {
    if (isPlayerChosen(i, groups.value)) {
      out[i] = true
    }
  })
  return out
})

let isChoosingPlayer = ref(false)
let grpOnChoosing: number = -1
let posOnChoosing: number = -1

function choosePlayer(grp: number, pos: number) {
  grpOnChoosing = grp
  posOnChoosing = pos
  isChoosingPlayer.value = true
}
function unselectPlayer(grp: number, pos: number) {
  groups.value[grp].entriesIdx[pos] = EntryEmptyIdx
  emit('groups-updated', groups.value)
}
function playerChosen(entryIdx: number) {
  unselectPlayer(grpOnChoosing, posOnChoosing)
  removePlayerFromAllGroups(groups.value, entryIdx)
  groups.value[grpOnChoosing].entriesIdx[posOnChoosing] = entryIdx
  grpOnChoosing = -1
  posOnChoosing = -1
  isChoosingPlayer.value = false
  emit('groups-updated', groups.value)
}

let sleep = ref(10)

async function clearDrawClicked() {
  const ok = confirm('This will delete all players in the draw. Continue?')
  if (!ok) return
  clearDraw(props.category.entryType, groups.value)
  emit('groups-updated', groups.value)
}

async function autoDraw() {
  if (!isGroupEmpty(groups.value)) {
    const ok = confirm('Auto draw will overwrite existing players. Continue?')
    if (!ok) return
  }

  // Create arrays with both entry objects and their indices
  const seededPlayersWithIndices = props.category.entries
    .map((player, index) => ({ player, entryIdx: index }))
    .filter((item) => item.player.seeding && item.player.seeding > 0)

  const otherPlayersWithIndices = props.category.entries
    .map((player, index) => ({ player, entryIdx: index }))
    .filter((item) => !item.player.seeding)

  if (
    seededPlayersWithIndices.length + otherPlayersWithIndices.length !==
    props.category.entries.length
  ) {
    alert("Something's wrong. Please check player list")
  }

  clearDraw(props.category.entryType, groups.value)
  await new Promise((r) => setTimeout(r, sleep.value))

  // Pass the arrays with index information to doDraw
  doDraw(groups.value, seededPlayersWithIndices, otherPlayersWithIndices, sleep.value).catch(
    (e: any) => alert(e.message)
  )
  emit('groups-updated', groups.value)
}
</script>

<template>
  <div class="relative h-full w-full overflow-y-auto rounded-xl">
    <div class="h-12 flex justify-between border-0 border-solid bg-blue-300 outline-none">
      <div class="flex flex-col justify-center px-4 font-black">Draw for {{ category?.name }}</div>
      <div class="mr-14 flex items-center justify-between gap-x-4">
        <input
          type="number"
          placeholder="sleep"
          v-model="sleep"
          class="w-13 rounded border-none bg-blue-200 pl-1 outline-none"
        />
        <SimpleButton class="bg-blue-700 px-5 text-white" @click="autoDraw">AUTO DRAW</SimpleButton>
        <OutlinedButton class="border-red-700 px-5 text-red-700" @click="clearDrawClicked">
          CLEAR DRAW</OutlinedButton
        >
      </div>
    </div>
    <div class="h-17/18 flex flex-row">
      <div
        class="max-h-[calc(100vh-7rem)] w-64 flex flex-col overflow-y-auto border-0 border-r border-solid bg-blue-100 pb-2"
      >
        <div class="border-0 border-solid bg-blue-200 p-3 font-black">Players</div>
        <div
          class="mx-3 border-0 border-b border-blue-200 border-solid py-1 decoration-2 decoration-blue-700"
          :class="{
            'line-through': chosenPlayersIndices[i]
          }"
          v-for="(player, i) in players"
          :key="'player-' + i"
        >
          {{ player }}
        </div>
      </div>
      <div
        class="grid max-h-[calc(100vh-7rem)] w-full gap-4 overflow-y-auto bg-blue-200 p-4 lg:grid-cols-3 md:grid-cols-2 sm:grid-cols-1 xl:grid-cols-4"
      >
        <div
          v-for="(grp, i) in groups"
          :key="'group-' + i"
          class="flex flex-col border border-blue-200 rounded-lg border-solid bg-blue-100 p-2 shadow-sm hover:shadow-md"
        >
          <div class="py-2">Group {{ i + 1 }}</div>
          <div
            v-for="(entryIdx, j) in grp.entriesIdx"
            :key="'player-in-group-' + i + '-' + j"
            class="flex items-center py-3"
          >
            <div @click="choosePlayer(i, j)" class="i-line-md-edit cursor-pointer px-2" />
            <span> {{ j + 1 }}.</span>
            <span class="px-2">{{
              entryIdx !== EntryEmptyIdx && entryIdx >= 0 && entryIdx < category.entries.length
                ? getPlayerDisplay(category.entries[entryIdx])
                : ''
            }}</span>
            <div
              v-if="
                entryIdx !== EntryEmptyIdx && entryIdx >= 0 && entryIdx < category.entries.length
              "
              @click="unselectPlayer(i, j)"
              class="i-line-md-account-delete cursor-pointer px-2"
            />
          </div>
        </div>
      </div>
    </div>

    <div v-if="isChoosingPlayer" class="fixed bottom-6 top-6 w-full flex justify-center">
      <PlayersChooser
        :players="category.entries"
        @close="isChoosingPlayer = false"
        @player-chosen="playerChosen"
      >
      </PlayersChooser>
    </div>
  </div>
</template>
