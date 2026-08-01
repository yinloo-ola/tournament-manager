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
  <div class="p-4 space-y-8">
    <div v-for="(group, groupIndex) in categoryGroups" :key="groupIndex" class="overflow-x-auto">
      <h3 class="mb-3 flex items-center text-lg text-lime-700 font-semibold">
        Group {{ groupIndex + 1 }}
      </h3>
      <table
        class="min-w-full border border-lime-200 rounded-lg border-solid shadow-sm divide-y divide-gray-200 divide-solid"
      >
        <thead class="bg-lime-50">
          <tr>
            <th
              class="border-b border-r border-gray-200 px-4 py-2 text-left text-xs text-gray-500 font-medium tracking-wider uppercase"
            ></th>
            <th
              class="border-b border-gray-200 px-4 py-2 text-left text-xs text-gray-500 font-medium tracking-wider uppercase"
            >
              Player
            </th>
            <!-- Generate columns for each player in the group -->
            <th
              v-for="(_, playerIndex) in group.entriesIdx"
              :key="playerIndex"
              class="border-b border-r border-gray-200 px-4 py-2 text-center text-xs text-gray-500 font-medium tracking-wider uppercase"
            >
              {{ playerIndex + 1 }}
            </th>
            <th
              class="border-b border-r border-gray-200 px-4 py-2 text-center text-xs text-gray-500 font-medium tracking-wider uppercase"
            >
              Points
            </th>
            <th
              class="border-b border-gray-200 px-4 py-2 text-center text-xs text-gray-500 font-medium tracking-wider uppercase"
            >
              Position
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200 divide-solid">
          <!-- Row for each player in the group -->
          <tr
            v-for="(entryIdx, playerIndex) in group.entriesIdx"
            :key="entryIdx"
            class="transition-colors duration-150 divide-x divide-gray-200 hover:bg-lime-50"
          >
            <td
              class="whitespace-nowrap border-r border-gray-200 px-4 py-2 text-sm text-gray-900 font-medium"
            >
              {{ playerIndex + 1 }}
            </td>
            <td class="whitespace-nowrap border-r border-gray-200 px-4 py-2 text-sm text-gray-900">
              {{ props.category?.entries[entryIdx]?.name || 'NA' }}
              {{
                props.category?.entries[entryIdx]?.club
                  ? `(${props.category?.entries[entryIdx]?.club})`
                  : ''
              }}
            </td>
            <!-- Cell for each player matchup -->
            <td
              v-for="(opponentIdx, opponentIndex) in group.entriesIdx"
              :key="opponentIdx"
              class="border-r border-gray-200 px-4 py-2 text-center text-sm text-gray-500"
              :class="{ 'bg-gray-900': playerIndex === opponentIndex }"
            >
              <!-- Display match result if not the same player -->
              <span v-if="playerIndex !== opponentIndex">
                <!-- This would be replaced with actual match results in a real app -->
              </span>
            </td>
            <td
              class="whitespace-nowrap border-r border-gray-200 px-4 py-2 text-center text-sm text-gray-900"
            >
              {{ getPlayerPoints(group, props.category?.entries[entryIdx]!) }}
            </td>
            <td class="whitespace-nowrap px-4 py-2 text-center text-sm text-lime-700 font-medium">
              {{ getPlayerPosition(group, props.category?.entries[entryIdx]!) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
