<script setup lang="ts">
import OutlinedInput from '../widgets/OutlinedInput.vue'
import SimpleButton from '../widgets/SimpleButton.vue'
import type { Tournament } from '@/types/types'

const tournament = defineModel<Tournament>({
  required: true
})

const emit = defineEmits(['addCategory'])
</script>

<template>
  <OutlinedInput
    v-model="tournament.name"
    class="w-full"
    name="tournament"
    label="Tournament Name"
    type="text"
  ></OutlinedInput>
  <div class="flex flex-col gap-x-4">
    <div class="flex w-full gap-x-4 mb-2">
      <OutlinedInput
        class="w-full"
        name="categories"
        label="No. of Table"
        type="number"
        v-model="tournament.numTables"
      ></OutlinedInput>
      <OutlinedInput
        class="w-full"
        name="categories"
        label="Start Date/Time"
        type="datetime-local"
        v-model="tournament.startTime"
      ></OutlinedInput>
    </div>
    <div class="flex gap-x-4">
      <OutlinedInput
        class="w-full"
        name="categories"
        label="No. of Categories"
        type="number"
        :modelValue="tournament.categories.length"
        readonly
      ></OutlinedInput>
      <div class="flex flex-col justify-end">
        <SimpleButton @click="emit('addCategory')" class="h-10 w-42 bg-blue-600 text-white">
          ADD CATEGORY
        </SimpleButton>
      </div>
    </div>
  </div>
</template>
