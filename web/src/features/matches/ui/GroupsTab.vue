<script setup lang="ts">
import { computed } from 'vue'
import { type Group, type Entry } from '@/types/types'

const props = defineProps({
  category: {
    type: Object,
    required: false,
    default: null
  }
})

// Get all groups for the current category
const categoryGroups = computed(() => {
  return props.category?.groups || []
})

// Helper function to get player position in a group
const getPlayerPosition = (_group: Group, _player: Entry): number => {
  // This is a placeholder - in a real app you would calculate position based on points
  return 0
}

// Helper function to get player points in a group
const getPlayerPoints = (_group: Group, _player: Entry): number => {
  // This is a placeholder - in a real app you would calculate points based on match results
  return 0 // Placeholder value
}
</script>

<template>
  <div class="space-y-8">
    <div v-if="categoryGroups.length === 0" class="flex flex-col items-center gap-3 rounded-lg border border-dashed border-outline-variant bg-surface-container-low px-6 py-12 text-center">
      <span class="text-4xl opacity-40">👥</span>
      <p class="body-medium text-on-surface-variant">No groups yet — complete the draw to allocate entries into groups.</p>
    </div>
    <div v-for="(group, groupIndex) in categoryGroups" :key="groupIndex" class="overflow-x-auto">
      <h3 class="title-medium text-primary mb-3 flex items-center gap-2">
        <span class="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary-container px-2 label-small text-on-primary-container">{{ groupIndex + 1 }}</span>
        Group {{ groupIndex + 1 }}
      </h3>
      <table class="min-w-full border-collapse rounded-lg overflow-hidden elevation-1">
        <thead class="bg-surface-container-high">
          <tr>
            <th class="border-b border-r border-outline-variant px-4 py-2 text-left label-medium text-on-surface-variant uppercase"></th>
            <th class="border-b border-outline-variant px-4 py-2 text-left label-medium text-on-surface-variant uppercase">Player</th>
            <!-- Generate columns for each player in the group -->
            <th
              v-for="(_, playerIndex) in group.entriesIdx"
              :key="playerIndex"
              class="border-b border-r border-outline-variant px-4 py-2 text-center label-medium text-on-surface-variant uppercase"
            >
              {{ playerIndex + 1 }}
            </th>
            <th class="border-b border-r border-outline-variant px-4 py-2 text-center label-medium text-on-surface-variant uppercase">Pts</th>
            <th class="border-b border-outline-variant px-4 py-2 text-center label-medium text-on-surface-variant uppercase">Pos</th>
          </tr>
        </thead>
        <tbody class="bg-surface divide-y divide-outline-variant">
          <!-- Row for each player in the group -->
          <tr
            v-for="(entryIdx, playerIndex) in group.entriesIdx"
            :key="entryIdx"
            class="transition-colors duration-short ease-standard hover:bg-surface-container"
          >
            <td class="whitespace-nowrap border-r border-outline-variant px-4 py-2 body-medium text-on-surface font-medium">
              {{ playerIndex + 1 }}
            </td>
            <td class="whitespace-nowrap border-r border-outline-variant px-4 py-2 body-medium text-on-surface">
              {{ props.category?.entries[entryIdx]?.name || 'NA' }}
              <span v-if="props.category?.entries[entryIdx]?.club" class="text-on-surface-variant">
                ({{ props.category?.entries[entryIdx]?.club }})
              </span>
            </td>
            <!-- Cell for each player matchup -->
            <td
              v-for="(opponentIdx, opponentIndex) in group.entriesIdx"
              :key="opponentIdx"
              class="border-r border-outline-variant px-4 py-2 text-center body-medium"
              :class="playerIndex === opponentIndex ? 'bg-surface-container-high' : 'text-on-surface-variant'"
            >
              <!-- Display match result if not the same player -->
              <span v-if="playerIndex !== opponentIndex">
                <!-- This would be replaced with actual match results in a real app -->
              </span>
            </td>
            <td class="whitespace-nowrap border-r border-outline-variant px-4 py-2 text-center body-medium text-on-surface">
              {{ getPlayerPoints(group, props.category?.entries[entryIdx]!) }}
            </td>
            <td class="whitespace-nowrap px-4 py-2 text-center body-medium font-medium text-primary">
              {{ getPlayerPosition(group, props.category?.entries[entryIdx]!) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
