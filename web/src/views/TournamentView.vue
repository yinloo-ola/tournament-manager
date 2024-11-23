<script setup lang="ts">
import { Transition, ref } from 'vue'
import CategoryCard from '../components/CategoryCard.vue'
import TournamentInfo from '../components/TournamentInfo.vue'
import Draw from '../components/Draw.vue'
import type { Group, Player, Tournament } from '@/types/types'
import { dateInYyyyMmDdHhMmSs, exportTournamentJson } from '@/calculator/tournament'
import {
  apiExportDraftSchedule,
  apiExportRoundRobinExcel,
  apiGenerateRounds
} from '@/client/client'
import { getDateStringFromNow } from '@/calculator/date'
import { useRouter } from 'vue-router'

const router = useRouter()

let tournament = ref<Tournament>({
  name: '',
  numTables: 0,
  startTime: getDateStringFromNow(7, 9),
  categories: [
    {
      name: '',
      shortName: '',
      playersPerGrpMain: 3,
      playersPerGrpRemainder: 4,
      players: [],
      groups: [],
      durationMinutes: 0
    }
  ]
})

function addCategory() {
  tournament.value.categories.push({
    name: '',
    shortName: '',
    playersPerGrpMain: 3,
    playersPerGrpRemainder: 4,
    players: [],
    groups: [],
    durationMinutes: 0
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
function drawDone(groups: Array<Group>) {
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

let showTournamentMenu = ref(false)

function exportRoundRobin() {
  apiExportRoundRobinExcel(tournament.value)
    .then((blob) => {
      var a = document.createElement('a')
      var file = window.URL.createObjectURL(blob)
      a.href = file
      a.download = `${tournament.value.name}_rr_chart_${dateInYyyyMmDdHhMmSs(new Date(), '_')}.xlsx`
      a.click()
      window.URL.revokeObjectURL(file)
    })
    .catch((e: any) => {
      alert(e.message)
    })
}

async function exportDraftSchedule() {
  try {
    const tournamentRes = await apiGenerateRounds(tournament.value)
    console.log(tournamentRes)
    tournament.value = tournamentRes
  } catch (e: any) {
    alert(e.message)
  }
  apiExportDraftSchedule(tournament.value)
    .then((blob) => {
      var a = document.createElement('a')
      var file = window.URL.createObjectURL(blob)
      a.href = file
      a.download = `${tournament.value.name}_draft_schedule_${dateInYyyyMmDdHhMmSs(new Date(), '_')}.xlsx`
      a.click()
      window.URL.revokeObjectURL(file)
    })
    .catch((e: any) => {
      alert(e.message)
    })
}
</script>

<template>
  <main class="flex flex-col">
    <header class="flex items-center justify-between bg-lime-200 shadow-xl">
      <div class="px-4 text-2xl text-lime-900 font-800">
        Tournament Manager <span class="px-4 font-black">{{ tournament.name }}</span>
      </div>
      <div
        @mouseover="showTournamentMenu = true"
        @mouseleave="showTournamentMenu = false"
        class="relative px-3 py-2"
      >
        <button class="bg-lime-900 text-white i-line-md-menu-fold-left h-8 w-8"></button>
        <Transition name="bounce">
          <div
            v-if="showTournamentMenu"
            class="absolute z-50 right-0 rounded-lg flex flex-col w-fit gap-1 p-2 mr-4 bg-gray-200 border-solid border border-gray-300 shadow-xl"
          >
            <div
              @click.prevent="exportTournament"
              class="py-2 px-4 rounded-md cursor-pointer hover:bg-lime-700 hover:text-white"
            >
              SAVE
            </div>
            <div
              @click.prevent="tournamentFile?.click()"
              class="py-2 px-4 rounded-md cursor-pointer hover:bg-lime-700 hover:text-white"
            >
              LOAD
            </div>
            <div
              @click.prevent="exportRoundRobin"
              class="py-2 px-4 rounded-md cursor-pointer hover:bg-lime-700 hover:text-white w-38"
            >
              EXPORT RR CHARTS
            </div>
            <div
              @click.prevent="exportDraftSchedule"
              class="py-2 px-4 rounded-md cursor-pointer hover:bg-lime-700 hover:text-white w-38"
            >
              EXPORT DRAFT SCHEDULE
            </div>
            <div
              @click="router.push('/schedule')"
              class="py-2 px-4 rounded-md cursor-pointer hover:bg-lime-700 hover:text-white"
            >
              SCHEDULE
            </div>
          </div>
        </Transition>
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
    <Transition name="bounce">
      <div
        v-if="drawIndex >= 0"
        class="fixed inset-2 bg-blue-200 rounded-xl shadow-xl border border-solid border-gray-300"
      >
        <Draw :category="tournament.categories[drawIndex]" @close="drawDone"></Draw>
      </div>
    </Transition>
  </main>
</template>

<style>
.bounce-enter-active {
  animation: bounce-in 0.3s;
}
.bounce-leave-active {
  animation: bounce-in 0.3s reverse;
}
@keyframes bounce-in {
  0% {
    transform: scale(0);
  }
  70% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
  }
}
</style>
