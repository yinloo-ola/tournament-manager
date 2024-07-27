<script setup lang="ts">
import { computed, ref } from 'vue'
import Papa from 'papaparse'
import LabeledInput from '../widgets/LabeledInput.vue'
import OutlinedButton from '../widgets/OutlinedButton.vue'
import type { Category } from '@/types/types'
import { isGroupEmpty } from '@/calculator/groups'

const file = ref<HTMLInputElement | null>(null)
function onFileSelected(event: any) {
  if (event.target.files.length === 0) {
    alert('No files selected')
    return
  }
  const out = Papa.parse(event.target.files[0], {
    skipEmptyLines: true,
    header: true,
    transformHeader: (s: string) => {
      return s.charAt(0).toLowerCase() + s.slice(1)
    },
    transform(value, field) {
      if (field === 'seeding') {
        return +value
      } else if (field === 'name') {
        return value.trim()
      }
      return value
    },
    complete(results) {
      if (results.errors.length !== 0) {
        alert('Problem parsing CSV. Please ensure that your CSV is valid')
        return
      }
      if (!results.meta.fields?.includes('name')) {
        alert('CSV must contains a "name" header')
        return
      }
      if (!results.meta.fields?.includes('club')) {
        alert('CSV must contains a "club" header')
        return
      }
      if (!results.meta.fields?.includes('seeding')) {
        alert('CSV must contains a "seeding" header')
        return
      }
      if (results.data.length === 0) {
        alert('No players found')
        return
      }
      const names: { [key: string]: boolean } = {}
      for (let i = 0; i < results.data.length; i++) {
        const player: any = results.data[i]
        if (!player['name'] || typeof player['name'] !== 'string' || player['name'].length === 0) {
          emit('error', 'Name cannot be empty')
          return
        }
        if (names[player['name']]) {
          emit('error', 'Duplicate player detected: ' + player['name'])
          return
        }
        names[player['name']] = true
      }
      emit('playersImported', results.data)
    }
  })
  file.value!.value = ''
}

function playerCountChanged(countType: string) {
  emit('playerCountChanged', countType)
}

const category = defineModel<Category>({
  required: true
})

let canChangePlayersPerGrp = computed(() => isGroupEmpty(category.value.groups))

const emit = defineEmits(['remove', 'playersImported', 'startDraw', 'error', 'playerCountChanged'])
</script>

<template>
  <div
    class="relative flex flex-col border border-solid border-gray-200 rounded-lg shadow-sm bg-gray-100 p-3 hover:shadow-xl"
  >
    <div @click="emit('remove')" class="i-line-md-close absolute right-3 top-3 cursor-pointer" />
    <div class="h-0.5"></div>
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
      name="players"
      label="Players Per Group (Main)"
      type="number"
      v-model="category.playersPerGrpMain"
      @change="() => playerCountChanged('main')"
      :readonly="!canChangePlayersPerGrp"
    ></LabeledInput>
    <LabeledInput
      name="players"
      label="Players Per Group (Remainder)"
      type="number"
      v-model="category.playersPerGrpRemainder"
      @change="() => playerCountChanged('remainder')"
      :readonly="!canChangePlayersPerGrp"
    ></LabeledInput>
    <LabeledInput
      name="playerCount"
      label="Players Count"
      type="number"
      readonly
      v-model="category.players.length"
    ></LabeledInput>
    <div class="flex flex-row justify-between gap-4 pb-1 pt-4">
      <input
        type="file"
        name="inputfile"
        id="inputfile"
        class="hidden"
        ref="file"
        accept=".csv"
        @change="onFileSelected"
      />
      <OutlinedButton
        @click="emit('startDraw')"
        class="border-blue-600 text-blue-700 hover:bg-blue-700 hover:text-white"
        :disabled="category.players.length === 0"
      >
        DO DRAW
      </OutlinedButton>
      <OutlinedButton
        @click="file?.click()"
        class="border-blue-600 text-blue-700 hover:bg-blue-700 hover:text-white"
      >
        IMPORT PLAYERS
      </OutlinedButton>
    </div>
    <div>
      <div v-for="(grp, g) in category.groups" class="px-2 py-2">
        Group {{ g + 1 }}
        <div v-for="(round, r) in grp.rounds" class="px-2 py-1">
          Round {{ r + 1 }}
          <div v-for="(match, m) in round" class="px-2">
            {{ match.player1.name }} vs {{ match.player2.name }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
