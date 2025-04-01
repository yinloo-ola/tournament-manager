<script setup lang="ts">
import { computed } from 'vue'
import { type Match } from '@/types/types'
import { formatDate, formatTime } from '@/calculator/date'

const props = defineProps({
  category: {
    type: Object,
    required: false,
    default: null
  }
})

const groupMatches = computed(() => {
  let allMatches: Array<Match> = []
  if (props.category?.groups) {
    props.category.groups.forEach((g: any, i: number) => {
      g.rounds.forEach((r: any) => {
        r.forEach((m: Match) => {
          m.groupIdx = i + 1
          allMatches.push(m)
        })
      })
    })
  }

  // Sort matches by datetime (ascending) and then by table (ascending)
  return allMatches.sort((a, b) => {
    // First sort by datetime
    const dateTimeCompare = new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
    if (dateTimeCompare !== 0) {
      return dateTimeCompare
    }

    // If datetime is the same, sort by table
    // First try to sort by the full table string (alphanumeric comparison)
    // This will properly handle cases like 'T1', 'T2', 'T11', etc.
    return a.table.localeCompare(b.table, undefined, { numeric: true, sensitivity: 'base' })
  })
})
</script>

<template>
  <div class="p-4">
    <table
      class="min-w-full border border-lime-200 rounded-lg border-solid divide-y divide-gray-200"
    >
      <thead class="sticky top-0 z-10 border bg-lime-50">
        <tr>
          <th
            scope="col"
            class="px-6 py-3 text-left text-xs text-lime-700 font-medium tracking-wider uppercase"
          >
            Group
          </th>
          <th
            scope="col"
            class="px-6 py-3 text-left text-xs text-lime-700 font-medium tracking-wider uppercase"
          >
            Table
          </th>
          <th
            scope="col"
            class="px-6 py-3 text-left text-xs text-lime-700 font-medium tracking-wider uppercase"
          >
            Date
          </th>
          <th
            scope="col"
            class="px-6 py-3 text-left text-xs text-lime-700 font-medium tracking-wider uppercase"
          >
            Time
          </th>
          <th
            scope="col"
            class="px-6 py-3 text-left text-xs text-lime-700 font-medium tracking-wider uppercase"
          >
            Player 1
          </th>
          <th
            scope="col"
            class="px-6 py-3 text-left text-xs text-lime-700 font-medium tracking-wider uppercase"
          >
            Player 2
          </th>
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200">
        <tr
          v-for="match in groupMatches"
          :key="match.datetime"
          class="transition-colors duration-150 hover:bg-lime-50"
        >
          <!-- Extracting group information from the match context -->
          <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
            {{ match.groupIdx }}
          </td>
          <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
            {{ match.table }}
          </td>
          <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
            {{ formatDate(match.datetime) }}
          </td>
          <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
            {{ formatTime(match.datetime) }}
          </td>
          <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-900 font-medium">
            {{ props.category?.entries[match.entry1Idx]?.name || 'NA' }}
          </td>
          <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-900 font-medium">
            {{ props.category?.entries[match.entry2Idx]?.name || 'NA' }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
