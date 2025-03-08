<script setup lang="ts">
import { ref, computed } from 'vue'
import CategoryCard from '../components/CategoryCard.vue'
import TournamentInfo from '../components/TournamentInfo.vue'
import TournamentDraw from '../components/TournamentDraw.vue'
import DropdownMenu from '../widgets/DropdownMenu.vue'
import MenuItem from '../widgets/MenuItem.vue'
import ModalDialog from '../widgets/ModalDialog.vue'
import type { Group, KnockoutRound, Player, Tournament } from '@/types/types'
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
import { importFinalSchedule } from '@/calculator/schedule'
import { calculatorGroups, getGroup } from '@/calculator/groups'

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
      durationMinutes: 0,
      knockoutRounds: [],
      numQualifiedPerGroup: 0
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
    durationMinutes: 0,
    knockoutRounds: [],
    numQualifiedPerGroup: 0
  })
}

function playersImported(categoryIdx: number, players: Player[]) {
  clearGroup(categoryIdx)
  tournament.value.categories[categoryIdx].players = players

  const { numGroupsMain, numGroupsRemainder } = calculatorGroups(
    tournament.value.categories[categoryIdx].players.length,
    tournament.value.categories[categoryIdx].playersPerGrpMain,
    tournament.value.categories[categoryIdx].playersPerGrpRemainder
  )

  if (
    tournament.value.categories[categoryIdx].playersPerGrpMain >
    tournament.value.categories[categoryIdx].playersPerGrpRemainder
  ) {
    for (let i = 0; i < numGroupsRemainder; i++) {
      tournament.value.categories[categoryIdx].groups.push(
        getGroup(tournament.value.categories[categoryIdx].playersPerGrpRemainder)
      )
    }
    for (let i = 0; i < numGroupsMain; i++) {
      tournament.value.categories[categoryIdx].groups.push(
        getGroup(tournament.value.categories[categoryIdx].playersPerGrpMain)
      )
    }
  } else {
    for (let i = 0; i < numGroupsMain; i++) {
      tournament.value.categories[categoryIdx].groups.push(
        getGroup(tournament.value.categories[categoryIdx].playersPerGrpMain)
      )
    }
    for (let i = 0; i < numGroupsRemainder; i++) {
      tournament.value.categories[categoryIdx].groups.push(
        getGroup(tournament.value.categories[categoryIdx].playersPerGrpRemainder)
      )
    }
  }
}

function clearGroup(categoryIdx: number) {
  tournament.value.categories[categoryIdx].groups = []
}

const drawIndex = ref(-1)
const showDrawModal = computed({
  get: () => drawIndex.value >= 0,
  set: (value: boolean) => {
    if (!value) {
      // If the modal is being closed, save the current groups data
      if (drawIndex.value >= 0 && tournament.value.categories[drawIndex.value].groups.length > 0) {
        drawDone(tournament.value.categories[drawIndex.value].groups);
      } else {
        drawIndex.value = -1
      }
    }
  }
})
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
async function drawDone(groups: Array<Group>) {
  if (
    tournament.value.categories[drawIndex.value].groups == null ||
    tournament.value.categories[drawIndex.value].groups.length === 0
  ) {
    tournament.value.categories[drawIndex.value].groups = groups
  } else {
    tournament.value.categories[drawIndex.value].groups.forEach(
      (_g, i) =>
        (tournament.value.categories[drawIndex.value].groups[i].players = groups[i].players)
    )
  }
  drawIndex.value = -1
  const tournamentRes = await apiGenerateRounds(tournament.value)
  tournament.value = tournamentRes
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
  apiImportFinalSchedule(file)
    .then((response: {
      categoriesGroupsMap: { [category: string]: Group[] },
      categoriesKnockoutRoundsMap: { [category: string]: KnockoutRound[] }
    }) => {
      console.log(response)
      const ok = importFinalSchedule(
        response.categoriesGroupsMap,
        response.categoriesKnockoutRoundsMap,
        tournament.value
      )
      if (!ok) {
        return
      }
      alert('Final schedule imported successfully')
    })
    .catch((error) => {
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
  tournamentFile.value!.value = ''
}
function onReaderLoad(event: ProgressEvent<FileReader>) {
  const result = event.target?.result as string
  const obj = JSON.parse(result)
  tournament.value = obj
}

// We're now using direct function calls in the template

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
    return
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
      <div class="px-3 py-2">
        <DropdownMenu>
          <MenuItem label="SAVE" @click="exportTournament()" />
          <MenuItem label="LOAD" @click="tournamentFile?.click()" />
          <MenuItem divider />
          <MenuItem label="EXPORT RR CHARTS" wide @click="exportRoundRobin()" />
          <MenuItem label="EXPORT DRAFT SCHEDULE" wide @click="exportDraftSchedule()" />
          <MenuItem label="IMPORT FINAL SCHEDULE" wide @click="finalScheduleFile?.click()" />
          <MenuItem label="EXPORT SCORESHEET WITH TEMPLATE" wide @click="exportScoresheetWithTemplateFile?.click()" />
          <MenuItem label="SCHEDULE" @click="router.push('/schedule')" />
        </DropdownMenu>
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
    <ModalDialog v-model="showDrawModal" content-class="bg-blue-200">
      <TournamentDraw v-if="drawIndex >= 0" :category="tournament.categories[drawIndex]">
      </TournamentDraw>
    </ModalDialog>
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
