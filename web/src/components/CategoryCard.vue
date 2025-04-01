<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { apiImportSinglesEntry, apiImportDoublesEntry, apiImportTeamEntry } from '@/client/client'
import LabeledInput from '../widgets/LabeledInput.vue'
import { EntryType } from '@/types/types'
import OutlinedButton from '../widgets/OutlinedButton.vue'
import LabeledSelect from '../widgets/LabeledSelect.vue'
import type { Category, LineupItem } from '@/types/types'
import { isGroupEmpty } from '@/calculator/groups'
import SimpleButton from '@/widgets/SimpleButton.vue'
import router from '@/router'
import TeamLineupModal from './TeamLineupModal.vue'

const isDebug = ref(false)
const file = ref<HTMLInputElement | null>(null)
const showTeamLineupModal = ref(false)
function onFileSelected(event: any) {
  if (event.target.files.length === 0) {
    alert('No files selected')
    return
  }

  // Check the category entryType and call the appropriate API function
  switch (category.value.entryType) {
    case EntryType.Singles:
      apiImportSinglesEntry(event.target.files[0])
        .then((data) => {
          emit('playersImported', data)
        })
        .catch((error) => {
          alert(error.message)
        })
      break
    case EntryType.Doubles:
      apiImportDoublesEntry(event.target.files[0])
        .then((data) => {
          emit('playersImported', data)
        })
        .catch((error) => {
          alert(error.message)
        })
      break
    case EntryType.Team:
      if (!category.value.minPlayers || !category.value.maxPlayers) {
        alert('Please set minimum and maximum players for team')
        return
      }
      if (category.value.minPlayers < 1 || category.value.maxPlayers < 1) {
        alert('Minimum and maximum players must be greater than 0')
        return
      }
      if (category.value.minPlayers > category.value.maxPlayers) {
        alert('Minimum players must be less than maximum players')
        return
      }
      apiImportTeamEntry(event.target.files[0], calculateMinPlayers(), category.value.maxPlayers)
        .then((data) => {
          emit('playersImported', data)
        })
        .catch((error) => {
          alert(error.message)
        })
      break
    default:
      alert('Please select an entry type before importing')
      return
  }

  file.value!.value = ''
}

function playerCountChanged(countType: string) {
  emit('playerCountChanged', countType)
}

const category = defineModel<Category>({
  required: true
})

// Initialize maxPlayers if it doesn't exist
if (category.value.entryType === EntryType.Team && !category.value.maxPlayers) {
  category.value.maxPlayers = 5
}

// Watch for entry type changes and clear lineup when changed from Team to another type
watch(
  () => category.value.entryType,
  (newEntryType, oldEntryType) => {
    if (oldEntryType === EntryType.Team && newEntryType !== EntryType.Team) {
      // Clear lineup data when changing from Team to another entry type
      if (category.value.lineup) {
        delete category.value.lineup
      }
      if (category.value.minPlayers) {
        delete category.value.minPlayers
      }
      if (category.value.maxPlayers) {
        delete category.value.maxPlayers
      }
    }
  }
)

// Function to calculate minimum players required based on lineup
function calculateMinPlayers() {
  if (!category.value.lineup || category.value.lineup.length === 0) {
    return 1 // Default minimum if no lineup is defined
  }

  const playerCounts = new Map<string, number>()

  category.value.lineup.forEach((item) => {
    if (item.matchType === EntryType.Singles) {
      if (item.genderRequirement === 'M') {
        playerCounts.set('M', (playerCounts.get('M') || 0) + 1)
      } else if (item.genderRequirement === 'F') {
        playerCounts.set('F', (playerCounts.get('F') || 0) + 1)
      } else {
        // For 'Any' or 'Mixed' in singles, we need at least one player
        playerCounts.set('Any', (playerCounts.get('Any') || 0) + 1)
      }
    } else if (item.matchType === EntryType.Doubles) {
      if (item.genderRequirement === 'M') {
        playerCounts.set('M', (playerCounts.get('M') || 0) + 2)
      } else if (item.genderRequirement === 'F') {
        playerCounts.set('F', (playerCounts.get('F') || 0) + 2)
      } else if (item.genderRequirement === 'Mixed') {
        playerCounts.set('M', (playerCounts.get('M') || 0) + 1)
        playerCounts.set('F', (playerCounts.get('F') || 0) + 1)
      } else {
        // For 'Any' in doubles, we need at least two players
        playerCounts.set('Any', (playerCounts.get('Any') || 0) + 2)
      }
    }
  })

  // Calculate total minimum players needed
  let total = 0
  playerCounts.forEach((count) => {
    total += count
  })

  return Math.max(1, total) // Ensure at least 1 player is required
}

// Function to handle saving lineup data from the modal
function saveTeamLineup(data: { lineup: LineupItem[]; maxPlayers: number }) {
  category.value.lineup = data.lineup
  category.value.maxPlayers = data.maxPlayers
  // Remove minPlayers as it's now calculated from the lineup
  if ('minPlayers' in category.value) {
    delete category.value.minPlayers
  }
}

let canChangePlayersPerGrp = computed(() => isGroupEmpty(category.value.groups))

const emit = defineEmits(['remove', 'playersImported', 'startDraw', 'error', 'playerCountChanged'])

const isEntryTypeSelected = computed(() => {
  return category.value.entryType !== EntryType.Unknown
})

const hasEntries = computed(() => {
  return category.value.entries && category.value.entries.length > 0
})
</script>

<template>
  <div
    class="relative flex flex-col border border-gray-200 rounded-lg border-solid bg-gray-100 p-3 shadow-sm hover:shadow-xl"
  >
    <div @click="emit('remove')" class="i-line-md-close absolute right-3 top-3 cursor-pointer" />
    <div class="h-0.5"></div>
    <LabeledSelect
      name="entryType"
      label="Entry Type"
      :options="[
        { value: 'Singles', label: 'Singles' },
        { value: 'Doubles', label: 'Doubles' },
        { value: 'Team', label: 'Team' }
      ]"
      v-model="category.entryType"
    ></LabeledSelect>
    <div
      v-if="category.entryType === EntryType.Team"
      class="mb-2 mt-1 rounded-lg border-none bg-blue-100 p-3 text-sm"
    >
      <div class="mb-2 flex items-center justify-between">
        <div class="text-base text-blue-800 font-bold">Team Configuration</div>
        <SimpleButton
          @click="showTeamLineupModal = true"
          class="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
        >
          Edit Lineup
        </SimpleButton>
      </div>
      <div v-if="category.lineup && category.lineup.length > 0" class="text-gray-700">
        <div class="flex justify-between border-b border-blue-100 pb-1">
          <span>Max Players:</span>
          <span class="font-medium">{{ category.maxPlayers }}</span>
        </div>
        <div class="flex justify-between border-b border-blue-100 py-1">
          <span>Min Players:</span>
          <span class="font-medium">{{ calculateMinPlayers() }}</span>
        </div>
        <div class="flex justify-between pt-1">
          <span>Match Count:</span>
          <span class="font-medium">{{ category.lineup.length }}</span>
        </div>
      </div>
      <div v-else class="text-gray-700 italic">
        No lineup configured. Click "Edit Lineup" to set up team matches.
      </div>
    </div>
    <LabeledInput
      name="category"
      label="Category"
      type="text"
      v-model="category.name"
    ></LabeledInput>
    <LabeledInput
      name="categoryShort"
      label="Short Form"
      type="text"
      v-model="category.shortName"
    ></LabeledInput>
    <LabeledInput
      name="durationMinutes"
      label="Match Duration (minutes)"
      type="number"
      v-model.number="category.durationMinutes"
    ></LabeledInput>
    <LabeledInput
      name="numQualifiedPerGroup"
      label="Qualifying Entries Per Group"
      type="number"
      v-model.number="category.numQualifiedPerGroup"
    ></LabeledInput>
    <LabeledInput
      name="players"
      label="Entries Per Group (Main)"
      type="number"
      v-model="category.entriesPerGrpMain"
      @change="() => playerCountChanged('main')"
      :readonly="!canChangePlayersPerGrp"
    ></LabeledInput>
    <LabeledInput
      name="players"
      label="Entries Per Group (Remainder)"
      type="number"
      v-model="category.entriesPerGrpRemainder"
      @change="() => playerCountChanged('remainder')"
      :readonly="!canChangePlayersPerGrp"
    ></LabeledInput>
    <LabeledInput
      name="playerCount"
      label="Entries Count"
      type="number"
      readonly
      v-model="category.entries.length"
    >
    </LabeledInput>
    <div class="flex flex-row justify-between gap-4 pb-1 pt-4">
      <input
        type="file"
        name="inputfile"
        id="inputfile"
        class="hidden"
        ref="file"
        accept=".xlsx"
        @change="onFileSelected"
      />
      <OutlinedButton
        @click="emit('startDraw')"
        class="border-blue-600 text-blue-700 hover:bg-blue-700 hover:text-white"
        :disabled="category.entries.length === 0"
      >
        DO DRAW
      </OutlinedButton>
      <OutlinedButton
        @click="file?.click()"
        class="border-blue-600 text-blue-700 hover:bg-blue-700 hover:text-white"
        :disabled="!isEntryTypeSelected"
      >
        IMPORT ENTRIES
      </OutlinedButton>
    </div>
    <div class="pb-1 pt-4">
      <SimpleButton
        @click="router.push(`/tournament/matches/${category.shortName}`)"
        class="h-10 w-full rounded-lg bg-blue-600 text-center text-white"
        :disabled="!hasEntries"
      >
        Matches
      </SimpleButton>
    </div>
    <div v-if="isDebug">
      <div v-for="(grp, g) in category.groups" :key="'group-' + g" class="px-2 py-2">
        Group {{ g + 1 }}
        <div v-for="(round, r) in grp.rounds" :key="'round-' + g + '-' + r" class="px-2 py-1">
          Round {{ r + 1 }}
          <div v-for="(match, m) in round" :key="'match-' + g + '-' + r + '-' + m" class="px-2">
            M{{ m + 1 }}
            <p class="text-red-700">{{ match.datetime }} on {{ match.table }}</p>
            <p>
              {{ category.entries[match.entry1Idx] }} vs {{ category.entries[match.entry2Idx] }}
              {{ match.durationMinutes }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Team Lineup Modal -->
  <TeamLineupModal v-model="showTeamLineupModal" :category="category" @save="saveTeamLineup" />
</template>
