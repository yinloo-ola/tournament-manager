<script setup lang="ts">
import OutlinedInput from '@/widgets/OutlinedInput.vue'
import type { Tournament } from '@/types/types'

const tournament = defineModel<Tournament>({
  required: true
})

const emit = defineEmits(['addCategory'])
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Tournament identity + schedule -->
    <div class="grid gap-x-6 gap-y-2 md:grid-cols-3">
      <OutlinedInput
        v-model="tournament.name"
        name="tournament"
        label="Tournament Name"
        type="text"
      ></OutlinedInput>
      <OutlinedInput
        name="tables"
        label="No. of Tables"
        type="number"
        v-model="tournament.numTables"
      ></OutlinedInput>
      <OutlinedInput
        name="startTime"
        label="Start Date / Time"
        type="datetime-local"
        v-model="tournament.startTime"
      ></OutlinedInput>
    </div>

    <!-- Category count + add -->
    <div class="flex items-end gap-4">
      <OutlinedInput
        class="md:max-w-xs"
        name="categories"
        label="No. of Categories"
        type="number"
        :modelValue="tournament.categories.length"
        readonly
      ></OutlinedInput>
    </div>
  </div>
</template>
