<script setup lang="ts">
import { computed, ref } from 'vue'
import { apiImportSinglesEntry, apiImportDoublesEntry, apiImportTeamEntry } from '@/client/client'
import LabeledInput from '../widgets/LabeledInput.vue'
import { EntryType } from '@/types/types'
import OutlinedButton from '../widgets/OutlinedButton.vue'
import LabeledSelect from '../widgets/LabeledSelect.vue'
import type { Category } from '@/types/types'
import { isGroupEmpty } from '@/calculator/groups'
import SimpleButton from '@/widgets/SimpleButton.vue'
import router from '@/router'

const isDebug = ref(false)
const file = ref<HTMLInputElement | null>(null)
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
      apiImportTeamEntry(event.target.files[0], category.value.minPlayers, category.value.maxPlayers)
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

// Initialize minPlayers and maxPlayers if they don't exist
if (category.value.entryType === EntryType.Team && !category.value.minPlayers) {
  category.value.minPlayers = 3
}
if (category.value.entryType === EntryType.Team && !category.value.maxPlayers) {
  category.value.maxPlayers = 5
}

let canChangePlayersPerGrp = computed(() => isGroupEmpty(category.value.groups))

const emit = defineEmits(['remove', 'playersImported', 'startDraw', 'error', 'playerCountChanged'])

const isEntryTypeSelected = computed(() => {
  return category.value.entryType !== EntryType.Unknown
})
</script>

<template>
  <div
    class="relative flex flex-col border border-gray-200 rounded-lg border-solid bg-gray-100 p-3 shadow-sm hover:shadow-xl">
    <div @click="emit('remove')" class="i-line-md-close absolute right-3 top-3 cursor-pointer" />
    <div class="h-0.5"></div>
    <LabeledSelect name="entryType" label="Entry Type" :options="[
      { value: 'Singles', label: 'Singles' },
      { value: 'Doubles', label: 'Doubles' },
      { value: 'Team', label: 'Team' }
    ]" v-model="category.entryType"></LabeledSelect>
    <LabeledInput name="category" label="Category" type="text" v-model="category.name"></LabeledInput>
    <LabeledInput name="categoryShort" label="Short Form" type="text" v-model="category.shortName"></LabeledInput>
    <LabeledInput name="durationMinutes" label="Match Duration (minutes)" type="number"
      v-model.number="category.durationMinutes"></LabeledInput>
    <LabeledInput v-if="category.entryType === EntryType.Team" name="minPlayers" label="Min Players Per Team" type="number"
      v-model.number="category.minPlayers"></LabeledInput>
    <LabeledInput v-if="category.entryType === EntryType.Team" name="maxPlayers" label="Max Players Per Team" type="number"
      v-model.number="category.maxPlayers"></LabeledInput>
    <LabeledInput name="numQualifiedPerGroup" label="Qualifying Entries Per Group" type="number"
      v-model.number="category.numQualifiedPerGroup"></LabeledInput>
    <LabeledInput name="players" label="Entries Per Group (Main)" type="number" v-model="category.entriesPerGrpMain"
      @change="() => playerCountChanged('main')" :readonly="!canChangePlayersPerGrp"></LabeledInput>
    <LabeledInput name="players" label="Entries Per Group (Remainder)" type="number"
      v-model="category.entriesPerGrpRemainder" @change="() => playerCountChanged('remainder')"
      :readonly="!canChangePlayersPerGrp"></LabeledInput>
    <LabeledInput name="playerCount" label="Entries Count" type="number" readonly v-model="category.entries.length">
    </LabeledInput>
    <div class="flex flex-row justify-between gap-4 pb-1 pt-4">
      <input type="file" name="inputfile" id="inputfile" class="hidden" ref="file" accept=".xlsx"
        @change="onFileSelected" />
      <OutlinedButton @click="emit('startDraw')"
        class="border-blue-600 text-blue-700 hover:bg-blue-700 hover:text-white"
        :disabled="category.entries.length === 0">
        DO DRAW
      </OutlinedButton>
      <OutlinedButton @click="file?.click()" class="border-blue-600 text-blue-700 hover:bg-blue-700 hover:text-white"
        :disabled="!isEntryTypeSelected">
        IMPORT ENTRIES
      </OutlinedButton>
    </div>
    <div class="pb-1 pt-4">
      <SimpleButton @click="router.push(`/tournament/matches/${category.shortName}`)"
        class="h-10 w-full rounded-lg bg-blue-600 text-center text-white">
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
            <p>{{ match.entry1.name }} vs {{ match.entry2.name }} {{ match.durationMinutes }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
