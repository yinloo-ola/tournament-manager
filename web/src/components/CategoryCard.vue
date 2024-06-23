<script setup lang="ts">
import { ref } from 'vue'
import Papa from 'papaparse'
import LabeledInput from '../widgets/LabeledInput.vue'
import OutlinedButton from '../widgets/OutlinedButton.vue'
import type { Category } from '@/types/types'

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
      emit('playersImported', results.data)
      alert('Players imported successfully')
    }
  })
}

const category = defineModel<Category>({
  required: true
})

const emit = defineEmits(['remove', 'playersImported', 'startDraw'])
</script>

<template>
  <div class="relative flex flex-col border rounded-lg border-solid p-3">
    <div @click="emit('remove')" class="i-line-md-close absolute right-3 top-3 cursor-pointer" />
    <div class="h-0.5"></div>
    <LabeledInput
      name="category"
      label="Category"
      type="text"
      v-model="category.name"
    ></LabeledInput>
    <LabeledInput
      name="players"
      label="Players Per Group (Main)"
      type="number"
      v-model="category.playersPerGrpMain"
    ></LabeledInput>
    <LabeledInput
      name="players"
      label="Players Per Group (Remainder)"
      type="number"
      v-model="category.playersPerGrpRemainder"
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
  </div>
</template>
