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

// Add knockout matches computed property
const knockoutMatches = computed(() => {
  let allMatches: Array<Match> = []
  if (props.category?.knockoutRounds) {
    props.category.knockoutRounds.forEach((k: any) => {
      k.matches.forEach((m: Match) => {
        allMatches.push({ ...m, round: k.round })
      })
    })
  }

  return allMatches.sort((a, b) => {
    const dateTimeCompare = new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
    if (dateTimeCompare !== 0) return dateTimeCompare
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
            Round
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
          v-for="match in knockoutMatches"
          :key="match.datetime"
          class="transition-colors duration-150 hover:bg-lime-50"
        >
          <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
            {{ match.round }}
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
