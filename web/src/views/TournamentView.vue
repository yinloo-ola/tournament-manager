<script setup lang="ts">
import { ref } from 'vue'
import CategoryCard from '../components/CategoryCard.vue'
import TournamentInfo from '../components/TournamentInfo.vue'
import Draw from '../components/Draw.vue'
import type { Player, Tournament } from '@/types/types'
import { exportTournamentJson } from '@/calculator/tournament'
import SimpleButton from '@/widgets/SimpleButton.vue'
import OutlinedButton from '@/widgets/OutlinedButton.vue'

let tournament = ref<Tournament>({
  name: '',
  categories: [
    {
      name: '',
      playersPerGrpMain: 3,
      playersPerGrpRemainder: 4,
      players: [],
      groups: []
    }
  ]
})

function addCategory() {
  tournament.value.categories.push({
    name: '',
    playersPerGrpMain: 3,
    playersPerGrpRemainder: 4,
    players: [],
    groups: []
  })
}

function playersImported(categoryIdx: number, players: Player[]) {
  clearGroup(categoryIdx)
  tournament.value.categories[categoryIdx].players = players
}

function clearGroup(categoryIdx: number) {
  tournament.value.categories[categoryIdx].groups = []
}

let drawIndex = ref(-1)
function startDraw(idx: number) {
  let diff =
    tournament.value.categories[idx].playersPerGrpMain -
    tournament.value.categories[idx].playersPerGrpRemainder
  if (Math.abs(diff) != 1) {
    alert(
      'Difference between "Players Per Group (Main)" and "Players Per Group (Remainder)" should be 1'
    )
    return
  }
  drawIndex.value = idx
}
function drawDone(groups: Player[][]) {
  tournament.value.categories[drawIndex.value].groups = groups
  drawIndex.value = -1
}

function showAlert(msg: string) {
  alert(msg)
}

function exportTournament() {
  exportTournamentJson(tournament.value)
}

const tournamentFile = ref<HTMLInputElement | null>(null)
function onTournamentFileSelected(event: any) {
  if (event.target.files.length === 0) {
    alert('No files selected')
    return
  }
  var reader = new FileReader()
  reader.onload = onReaderLoad
  reader.readAsText(event.target.files[0])
}
function onReaderLoad(event: any) {
  var obj = JSON.parse(event.target.result)
  tournament.value = obj
}
</script>

<template>
  <main class="flex flex-col">
    <header class="flex items-center justify-between bg-lime-200 shadow-xl">
      <div class="px-4 text-2xl text-gray-800">
        Tournament Manager <span class="px-4 font-black">{{ tournament.name }}</span>
      </div>
      <div class="group relative px-4 py-3">
        <button class="bg-lime-700 text-white i-line-md-menu-fold-left h-8 w-8"></button>
        <div
          class="invisible absolute z-50 right-0 rounded-lg flex flex-col w-fit gap-3 p-3 mr-4 bg-lime-100 border-solid border border-lime-200 shadow-xl group-hover:visible"
        >
          <SimpleButton
            @click.prevent="exportTournament"
            class="px-5 text-white bg-lime-700 py-2 rounded-md cursor-pointer"
            >EXPORT</SimpleButton
          >
          <OutlinedButton
            @click.prevent="tournamentFile?.click()"
            class="border-red-600 text-red-700 hover:bg-red-700 hover:text-white"
            >IMPORT</OutlinedButton
          >
        </div>
      </div>
    </header>
    <input
      type="file"
      name=""
      id=""
      ref="tournamentFile"
      @change="onTournamentFileSelected"
      class="invisible"
    />
    <div class="flex flex-col">
      <div class="flex flex-col gap-3 p-4">
        <TournamentInfo v-model="tournament" @addCategory="addCategory"></TournamentInfo>
      </div>

      <div
        class="grid gap-4 px-4 2xl:grid-cols-5 lg:grid-cols-3 md:grid-cols-2 sm:grid-cols-1 xl:grid-cols-4"
      >
        <template v-for="(category, i) in tournament.categories" :key="i">
          <CategoryCard
            v-model="tournament.categories[i]"
            @remove="tournament.categories.splice(i, 1)"
            @players-imported="(players) => playersImported(i, players)"
            @startDraw="startDraw(i)"
            @error="showAlert"
            @player-count-changed="clearGroup(i)"
          ></CategoryCard>
        </template>
      </div>
    </div>
    <div
      v-if="drawIndex >= 0"
      class="fixed inset-2 bg-blue-200 rounded-xl shadow-xl border border-solid border-gray-300"
    >
      <Draw :category="tournament.categories[drawIndex]" @close="drawDone"></Draw>
    </div>
  </main>
</template>

<style></style>
