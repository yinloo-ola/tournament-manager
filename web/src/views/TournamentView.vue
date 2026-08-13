<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import CategoryCard from '@/features/tournament-config/ui/CategoryCard.vue'
import TournamentInfo from '@/features/tournament-config/ui/TournamentInfo.vue'
import TournamentDraw from '@/features/draw/ui/TournamentDraw.vue'
import DropdownMenu from '../widgets/DropdownMenu.vue'
import MenuItem from '../widgets/MenuItem.vue'
import ModalDialog from '../widgets/ModalDialog.vue'
import SimpleButton from '../widgets/SimpleButton.vue'
import { type Group, type Tournament, Entry, EntryType } from '@/types/types'
import { dateInYyyyMmDdHhMmSs, injectEntriesTournament } from '@/calculator/tournament'
import { createRobinCharts } from '@/features/roundrobin/excel/roundrobinChartWorkbook'
import { exportScoresheets } from '@/features/scoresheet/excel/scoresheetWorkbook'
import ExcelJS from 'exceljs'
import { importFinalSchedule } from '@/calculator/schedule'
import { calculatorGroups, getGroup } from '@/features/draw/domain/groups'
import { generateRoundsForTournament } from '@/features/matches/domain/generateRounds'
import { scheduleMatches } from '@/features/schedule/domain/scheduleMatches'
import {
  createDraftScheduleWorkbook,
  workbookToBuffer
} from '@/features/schedule/excel/draftScheduleWorkbook'
import { importFinalScheduleFromBuffer } from '@/features/schedule/domain/importFinalSchedule'
import { buildLineupSeed } from '@/features/lineup-seed/domain/buildLineupSeed'
import { tournament } from '@/store/state'
import { saveTournamentDocument } from '@/features/tournament-doc/saveDocument'
import { saveFileSink } from '@/features/tournament-doc/storage/fileAccess'
import { useToast } from '@/shared/ui/toast'

const router = useRouter()
const { toast } = useToast()

function addCategory() {
  tournament.value.categories.push({
    name: '',
    entryType: EntryType.Singles,
    shortName: '',
    entriesPerGrpMain: 3,
    entriesPerGrpRemainder: 4,
    entries: [],
    groups: [],
    knockoutRounds: [],
    durationMinutes: 0,
    numQualifiedPerGroup: 0
  })
}

function repopulateGroups(categoryIdx: number) {
  const { numGroupsMain, numGroupsRemainder } = calculatorGroups(
    tournament.value.categories[categoryIdx].entries.length,
    tournament.value.categories[categoryIdx].entriesPerGrpMain,
    tournament.value.categories[categoryIdx].entriesPerGrpRemainder
  )

  if (
    tournament.value.categories[categoryIdx].entriesPerGrpMain >
    tournament.value.categories[categoryIdx].entriesPerGrpRemainder
  ) {
    for (let i = 0; i < numGroupsRemainder; i++) {
      tournament.value.categories[categoryIdx].groups.push(
        getGroup(tournament.value.categories[categoryIdx].entriesPerGrpRemainder)
      )
    }
    for (let i = 0; i < numGroupsMain; i++) {
      tournament.value.categories[categoryIdx].groups.push(
        getGroup(tournament.value.categories[categoryIdx].entriesPerGrpMain)
      )
    }
  } else {
    for (let i = 0; i < numGroupsMain; i++) {
      tournament.value.categories[categoryIdx].groups.push(
        getGroup(tournament.value.categories[categoryIdx].entriesPerGrpMain)
      )
    }
    for (let i = 0; i < numGroupsRemainder; i++) {
      tournament.value.categories[categoryIdx].groups.push(
        getGroup(tournament.value.categories[categoryIdx].entriesPerGrpRemainder)
      )
    }
  }
}

function playersImported(categoryIdx: number, players: Entry[]) {
  players = players.map((player, i) => {
    const entry = Entry.from(player)
    entry.grpIdx = i
    return entry
  })
  tournament.value.categories[categoryIdx].entries = players
  clearGroup(categoryIdx)
}

function clearGroup(categoryIdx: number) {
  tournament.value.categories[categoryIdx].groups = []
  repopulateGroups(categoryIdx)
}

const drawIndex = ref(-1)
const showDrawModal = computed({
  get: () => drawIndex.value >= 0,
  set: (value: boolean) => {
    if (!value) {
      // If the modal is being closed, save the current groups data
      if (drawIndex.value >= 0 && tournament.value.categories[drawIndex.value].groups.length > 0) {
        drawDone(tournament.value.categories[drawIndex.value].groups)
      } else {
        drawIndex.value = -1
      }
    }
  }
})
function startDraw(idx: number) {
  const diff =
    tournament.value.categories[idx].entriesPerGrpMain -
    tournament.value.categories[idx].entriesPerGrpRemainder
  if (Math.abs(diff) !== 1) {
    toast.error(
      'Difference between "Players Per Group (Main)" and "Players Per Group (Remainder)" should be 1'
    )
    return
  }
  drawIndex.value = idx
}
function drawDone(groups: Array<Group>) {
  if (
    tournament.value.categories[drawIndex.value].groups == null ||
    tournament.value.categories[drawIndex.value].groups.length === 0
  ) {
    tournament.value.categories[drawIndex.value].groups = groups
  } else {
    tournament.value.categories[drawIndex.value].groups.forEach(
      (_g, i) =>
        (tournament.value.categories[drawIndex.value].groups[i].entriesIdx = groups[i].entriesIdx)
    )
  }
  drawIndex.value = -1
  try {
    generateRoundsForTournament(tournament.value)
  } catch (e: unknown) {
    const error = e as Error
    toast.error(error.message)
  }
}

function showAlert(msg: string) {
  toast.error(msg)
}

async function saveTournament() {
  try {
    const result = await saveTournamentDocument(saveFileSink())
    if (!result.saved) return // user cancelled the save picker
    if (result.downloaded) {
      toast.info('Saved as a download — the original file was not updated.')
    }
  } catch (e) {
    showAlert(e instanceof Error ? e.message : 'Save failed')
  }
}

const exportScoresheetWithTemplateFile = ref<HTMLInputElement | null>(null)
function exportScoresheetWithTemplateSelected(event: Event) {
  const input = event.target as HTMLInputElement
  if (input === null) {
    toast.error('No file selected')
    return
  }
  if (input.files == null || input.files?.length === 0) {
    toast.error('No file selected')
    return
  }
  if (input.files[0] == null) {
    toast.error('No file selected')
    return
  }

  input.files[0]
    .arrayBuffer()
    .then(async (buffer: ArrayBuffer) => {
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(buffer)
      exportScoresheets(tournament.value, wb)
      const outBuffer = await workbookToBuffer(wb)
      const blob = new Blob([outBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      const a = document.createElement('a')
      const file = window.URL.createObjectURL(blob)
      a.href = file
      a.download = `${tournament.value.name}_scoresheet_${dateInYyyyMmDdHhMmSs(new Date(), '_')}.xlsx`
      a.click()
      window.URL.revokeObjectURL(file)
      toast.success('Scoresheets exported')
    })
    .catch((e: unknown) => {
      const error = e as Error
      toast.error(error.message)
    })

  if (exportScoresheetWithTemplateFile.value) {
    exportScoresheetWithTemplateFile.value.value = ''
  }
}

const finalScheduleFile = ref<HTMLInputElement | null>(null)
function finalScheduleFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  if (input === null) {
    toast.error('No file selected')
    return
  }
  const files = input.files
  if (files == null || files?.length === 0) {
    toast.error('No file selected')
    return
  }
  const file = files[0]
  if (file == null) {
    toast.error('No file selected')
    return
  }
  file
    .arrayBuffer()
    .then(async (buffer: ArrayBuffer) => {
      const result = await importFinalScheduleFromBuffer(new Uint8Array(buffer))
      const ok = importFinalSchedule(
        result.categoriesGroupsMap,
        result.categoriesKnockoutRoundsMap,
        tournament.value
      )
      if (!ok) {
        // schedule.ts returned false (e.g. no group data found for a category)
        toast.error('Could not import final schedule — check the category/group data.')
        return
      }
      toast.success('Final schedule imported successfully')
    })
    .catch((error) => {
      console.error('Error importing final schedule:', error)
      toast.error('Error importing final schedule: ' + error.message)
    })

  if (finalScheduleFile.value) {
    finalScheduleFile.value.value = ''
  }
}

const tournamentFile = ref<HTMLInputElement | null>(null)
function onTournamentFileSelected(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files?.length === 0) {
    toast.error('No files selected')
    return
  }
  const reader = new FileReader()
  reader.onload = onReaderLoad
  reader.readAsText(target.files![0])
  tournamentFile.value!.value = ''
}
function onReaderLoad(event: ProgressEvent<FileReader>) {
  const result = event.target?.result as string
  const obj = JSON.parse(result) as Tournament

  injectEntriesTournament(obj)

  tournament.value = obj
}

// We're now using direct function calls in the template

async function exportRoundRobin() {
  try {
    const wb = createRobinCharts(tournament.value)
    const buffer = await workbookToBuffer(wb)
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const a = document.createElement('a')
    const file = window.URL.createObjectURL(blob)
    a.href = file
    a.download = `${tournament.value.name}_rr_chart_${dateInYyyyMmDdHhMmSs(new Date(), '_')}.xlsx`
    a.click()
    window.URL.revokeObjectURL(file)
    toast.success('Round-robin charts exported')
  } catch (e: unknown) {
    const error = e as Error
    toast.error(error.message)
  }
}

async function exportDraftSchedule() {
  try {
    generateRoundsForTournament(tournament.value)
  } catch (e: unknown) {
    const error = e as Error
    toast.error(error.message)
    return
  }
  try {
    const schedule = scheduleMatches(tournament.value)
    const wb = createDraftScheduleWorkbook(tournament.value, schedule)
    const buffer = await workbookToBuffer(wb)
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const a = document.createElement('a')
    const file = window.URL.createObjectURL(blob)
    a.href = file
    a.download = `${tournament.value.name}_draft_schedule_${dateInYyyyMmDdHhMmSs(new Date(), '_')}.xlsx`
    a.click()
    window.URL.revokeObjectURL(file)
    toast.success('Draft schedule exported')
  } catch (e: unknown) {
    const error = e as Error
    toast.error(error.message)
  }
}

function exportLineupSeed() {
  try {
    const seed = buildLineupSeed(tournament.value)
    const blob = new Blob([JSON.stringify(seed, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    const file = window.URL.createObjectURL(blob)
    a.href = file
    a.download = `${tournament.value.name}_lineup_seed_${dateInYyyyMmDdHhMmSs(new Date(), '_')}.json`
    a.click()
    window.URL.revokeObjectURL(file)
    const hasTeam = tournament.value.categories.some((c) => c.entryType === EntryType.Team)
    toast.success(hasTeam ? 'Lineup seed exported' : 'Lineup seed exported (no Team categories)')
  } catch (e: unknown) {
    const error = e as Error
    toast.error(error.message)
  }
}

function updateGroups(groups: Group[]) {
  tournament.value.categories[drawIndex.value].groups = groups
}

function goHome() {
  router.push('/')
}
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <!-- App bar (decision 01): brand + tournament name on the left,
         Save (prominent filled) + Document ▾ menu on the right.
         The 6 actions previously buried in a hamburger are now surfaced. -->
    <header class="sticky top-0 z-20 flex items-center gap-2 px-4 py-3 elevation-1 bg-surface-container">
      <button
        @click="goHome"
        title="Back to launcher"
        class="flex h-10 w-10 items-center justify-center rounded-full border-0 bg-transparent text-on-surface-variant transition-all duration-short ease-standard hover:bg-surface-container-high hover:text-on-surface cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span class="i-line-md-arrow-left text-xl"></span>
      </button>
      <span class="text-xl">🏆</span>
      <span class="title-large hidden text-on-surface-variant sm:inline">Tournament Manager</span>
      <span class="title-large min-w-0 truncate text-primary">{{ tournament.name }}</span>

      <span class="flex-1"></span>

      <!-- Surfaced actions (decision 01) -->
      <SimpleButton variant="filled" @click="saveTournament()">
        <span class="i-line-md-document-list"></span>
        <span class="hidden sm:inline">Save</span>
      </SimpleButton>
      <DropdownMenu
        buttonClass="inline-flex items-center gap-2 rounded-full border-0 bg-primary-container px-6 h-10 text-sm font-medium tracking-[0.1px] text-on-primary-container transition-all duration-short ease-standard hover:elevation-1 active:scale-[.97] cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary"
        menuClass="absolute right-0 z-50 w-64 flex flex-col gap-1 rounded-sm bg-surface-container elevation-2 p-2"
      >
        <template #button-content>
          <span class="i-line-md-folder-open sm:hidden"></span>
          <span class="hidden sm:inline">Document</span>
          <span class="i-line-md-chevron-small-down text-lg"></span>
        </template>
        <MenuItem label="Load tournament" @click="tournamentFile?.click()" />
        <MenuItem divider />
        <MenuItem label="Export round-robin charts" @click="exportRoundRobin()" />
        <MenuItem label="Export draft schedule" @click="exportDraftSchedule()" />
          <MenuItem label="Import final schedule" @click="finalScheduleFile?.click()" />
          <MenuItem divider />
          <MenuItem label="Export lineup seed" @click="exportLineupSeed()" />
        <MenuItem divider />
        <MenuItem label="Export scoresheets (with template)" @click="exportScoresheetWithTemplateFile?.click()" />
      </DropdownMenu>
    </header>

    <!-- Hidden file inputs (unchanged mechanism) -->
    <input
      type="file"
      data-test="input-load"
      ref="tournamentFile"
      @change="onTournamentFileSelected"
      accept=".json"
      class="hidden"
    />
    <input
      type="file"
      data-test="input-scoresheet-template"
      ref="exportScoresheetWithTemplateFile"
      @change="exportScoresheetWithTemplateSelected"
      accept=".xlsx"
      class="hidden"
    />
    <input
      type="file"
      name="finalScheduleFile"
      id="finalScheduleFile"
      data-test="input-final-schedule"
      class="hidden"
      ref="finalScheduleFile"
      accept=".xlsx"
      @change="finalScheduleFileSelected"
    />

    <!-- Content -->
    <main class="mx-auto w-full max-w-[1600px] min-w-0 flex-1 px-6 py-6">
      <!-- Tournament info form -->
      <section class="mb-6 rounded-lg bg-surface px-6 py-5 elevation-1">
        <TournamentInfo v-model="tournament" @addCategory="addCategory"></TournamentInfo>
      </section>

      <!-- Categories section header -->
      <div class="mb-4 flex items-center justify-between">
        <h2 class="title-large text-on-surface">Categories</h2>
        <SimpleButton variant="tonal" @click="addCategory">
          <span class="i-line-md-plus"></span>
          Add category
        </SimpleButton>
      </div>

      <!-- Category cards grid, or empty state -->
      <div v-if="tournament.categories.length === 0" class="flex flex-col items-center gap-3 rounded-lg border border-dashed border-outline-variant bg-surface-container-low px-6 py-12 text-center">
        <span class="text-4xl opacity-40">🗂️</span>
        <p class="body-medium text-on-surface-variant">No categories yet — add one to get started.</p>
      </div>
      <div
        v-else
        class="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
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
    </main>

    <ModalDialog
      v-model="showDrawModal"
      content-class="bg-surface-container-high max-h-[95vh] max-w-[95vw] min-w-4/5"
    >
      <TournamentDraw
        v-if="drawIndex >= 0"
        :category="tournament.categories[drawIndex]"
        @groups-updated="updateGroups"
      >
      </TournamentDraw>
    </ModalDialog>
  </div>
</template>
