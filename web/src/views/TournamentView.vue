<script setup lang="ts">
import { ref } from 'vue'
import CategoryCard from '../components/CategoryCard.vue'
import TournamentInfo from '../components/TournamentInfo.vue'
import TournamentDraw from '../components/TournamentDraw.vue'
import type { Group, Player, Tournament } from '@/types/types'
import { dateInYyyyMmDdHhMmSs, exportTournamentJson } from '@/calculator/tournament'
import {
  apiExportDraftSchedule,
  apiExportRoundRobinExcel,
  apiExportScoresheetWithTemplate,
  apiGenerateRounds,
  apiImportFinalSchedule
} from '@/client/client'
import { getDateStringFromNow } from '@/calculator/date'
import { useRouter } from 'vue-router'

const router = useRouter()

const tournament = ref<Tournament>({
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

const drawIndex = ref(-1)
function startDraw(idx: number) {
  const diff =
    tournament.value.categories[idx].playersPerGrpMain -
    tournament.value.categories[idx].playersPerGrpRemainder
  if (Math.abs(diff) !== 1) {
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

const exportScoresheetWithTemplateFile = ref<HTMLInputElement | null>(null)
function exportScoresheetWithTemplateSelected(event: Event) {
  const input = event.target as HTMLInputElement
  if (input === null) {
    alert('No file selected')
    return
  }
  if (input.files == null || input.files?.length === 0) {
    alert('No file selected')
    return
  }
  if (input.files[0] == null) {
    alert('No file selected')
    return
  }

  apiExportScoresheetWithTemplate(tournament.value, input.files[0])
    .then((blob) => {
      const a = document.createElement('a')
      const file = window.URL.createObjectURL(blob)
      a.href = file
      a.download = `${tournament.value.name}_scoresheet_${dateInYyyyMmDdHhMmSs(new Date(), '_')}.xlsx`
      a.click()
      window.URL.revokeObjectURL(file)
    })
    .catch((e: Error) => {
      alert(e.message)
    })

  if (exportScoresheetWithTemplateFile.value) {
    exportScoresheetWithTemplateFile.value.value = ''
  }
}

const finalScheduleFile = ref<HTMLInputElement | null>(null)
function finalScheduleFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  if (input === null) {
    alert('No file selected')
    return
  }
  const files = input.files
  if (files == null || files?.length === 0) {
    alert('No file selected')
    return
  }
  const file = files[0]
  if (file == null) {
    alert('No file selected')
    return
  }
  apiImportFinalSchedule(file).then((categoriesGroupsMap: { [category: string]: Group[] }) => {
    console.log(categoriesGroupsMap)
    // replace the rounds of each group in each category with the ones from categoriesGroupsMap except for the durationMinutes in each match
    for (let categoryIdx = 0; categoryIdx < tournament.value.categories.length; categoryIdx++) {
      const category = tournament.value.categories[categoryIdx]
      // Check if this category exists in the imported data
      if (categoriesGroupsMap[category.shortName]) {
        const importedGroups = categoriesGroupsMap[category.shortName]

        // For each group in the category
        for (let i = 0; i < category.groups.length; i++) {
          // If there's a corresponding imported group
          category.groups[i].rounds = importedGroups[i].rounds
          for (let j = 0; j < category.groups[i].rounds.length; j++) {
            for (let k = 0; k < category.groups[i].rounds[j].length; k++) {
              category.groups[i].rounds[j][k].durationMinutes = category.durationMinutes
            }
          }
        }
      } else {
        alert(`No data found for category ${category.name}`)
        return
      }
    }
    // Removed self-assignment
    alert('Final schedule imported successfully')
  }).catch(error => {
    console.error('Error importing final schedule:', error)
    alert('Error importing final schedule: ' + error.message)
  })

  if (finalScheduleFile.value) {
    finalScheduleFile.value.value = ''
  }
}

const tournamentFile = ref<HTMLInputElement | null>(null)
function onTournamentFileSelected(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files?.length === 0) {
    alert('No files selected')
    return
  }
  const reader = new FileReader()
  reader.onload = onReaderLoad
  reader.readAsText(target.files![0])
}
function onReaderLoad(event: ProgressEvent<FileReader>) {
  const result = event.target?.result as string
  const obj = JSON.parse(result)
  tournament.value = obj
}

const showTournamentMenu = ref(false)

function exportRoundRobin() {
  apiExportRoundRobinExcel(tournament.value)
    .then((blob) => {
      const a = document.createElement('a')
      const file = window.URL.createObjectURL(blob)
      a.href = file
      a.download = `${tournament.value.name}_rr_chart_${dateInYyyyMmDdHhMmSs(new Date(), '_')}.xlsx`
      a.click()
      window.URL.revokeObjectURL(file)
    })
    .catch((e: Error) => {
      alert(e.message)
    })
}

async function exportDraftSchedule() {
  try {
    const tournamentRes = await apiGenerateRounds(tournament.value)
    console.log(tournamentRes)
    tournament.value = tournamentRes
  } catch (e: unknown) {
    const error = e as Error
    alert(error.message)
  }
  apiExportDraftSchedule(tournament.value)
    .then((blob) => {
      const a = document.createElement('a')
      const file = window.URL.createObjectURL(blob)
      a.href = file
      a.download = `${tournament.value.name}_draft_schedule_${dateInYyyyMmDdHhMmSs(new Date(), '_')}.xlsx`
      a.click()
      window.URL.revokeObjectURL(file)
    })
    .catch((e: Error) => {
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
      <div @mouseover="showTournamentMenu = true" @mouseleave="showTournamentMenu = false" class="relative px-3 py-2">
        <button class="i-line-md-menu-fold-left h-8 w-8 bg-lime-900 text-white"></button>
        <Transition name="bounce">
          <div v-if="showTournamentMenu"
            class="absolute right-0 z-50 mr-4 w-fit flex flex-col gap-1 border border-gray-300 rounded-lg border-solid bg-gray-200 p-2 shadow-xl">
            <div @click.prevent="exportTournament"
              class="cursor-pointer rounded-md px-4 py-2 hover:bg-lime-700 hover:text-white">
              SAVE
            </div>
            <div @click.prevent="tournamentFile?.click()"
              class="cursor-pointer rounded-md px-4 py-2 hover:bg-lime-700 hover:text-white">
              LOAD
            </div>
            <div class="border-0 border-b border-gray-400 border-solid"></div>
            <div @click.prevent="exportRoundRobin"
              class="w-38 cursor-pointer rounded-md px-4 py-2 hover:bg-lime-700 hover:text-white">
              EXPORT RR CHARTS
            </div>
            <div @click.prevent="exportDraftSchedule"
              class="w-38 cursor-pointer rounded-md px-4 py-2 hover:bg-lime-700 hover:text-white">
              EXPORT DRAFT SCHEDULE
            </div>
            <div @click="finalScheduleFile?.click()"
              class="w-38 cursor-pointer rounded-md px-4 py-2 hover:bg-lime-700 hover:text-white">
              IMPORT FINAL SCHEDULE
            </div>
            <div @click="exportScoresheetWithTemplateFile?.click()"
              class="w-38 cursor-pointer rounded-md px-4 py-2 hover:bg-lime-700 hover:text-white">
              EXPORT SCORESHEET WITH TEMPLATE
            </div>
            <div @click="router.push('/schedule')"
              class="cursor-pointer rounded-md px-4 py-2 hover:bg-lime-700 hover:text-white">
              SCHEDULE
            </div>
          </div>
        </Transition>
      </div>
    </header>
    <input type="file" name="" id="" ref="tournamentFile" @change="onTournamentFileSelected" accept=".json"
      class="invisible" />
    <input type="file" ref="exportScoresheetWithTemplateFile" @change="exportScoresheetWithTemplateSelected"
      accept=".xlsx" class="invisible" />
    <input type="file" name="finalScheduleFile" id="finalScheduleFile" class="hidden" ref="finalScheduleFile"
      accept=".xlsx" @change="finalScheduleFileSelected" />
    <div class="flex flex-col">
      <div class="flex flex-col gap-3 p-4">
        <TournamentInfo v-model="tournament" @addCategory="addCategory"></TournamentInfo>
      </div>

      <div class="grid gap-4 px-4 2xl:grid-cols-5 lg:grid-cols-3 md:grid-cols-2 sm:grid-cols-1 xl:grid-cols-4">
        <template v-for="(category, i) in tournament.categories" :key="i">
          <CategoryCard v-model="tournament.categories[i]" @remove="tournament.categories.splice(i, 1)"
            @players-imported="(players) => playersImported(i, players)" @startDraw="startDraw(i)" @error="showAlert"
            @player-count-changed="clearGroup(i)"></CategoryCard>
        </template>
      </div>
    </div>
    <Transition name="bounce">
      <div v-if="drawIndex >= 0"
        class="fixed inset-2 border border-gray-300 rounded-xl border-solid bg-blue-200 shadow-xl">
        <TournamentDraw :category="tournament.categories[drawIndex]" @close="drawDone"></TournamentDraw>
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
