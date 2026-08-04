<script setup lang="ts">
import { type Match } from '@/types/types'
import { formatDate, formatTime } from '@/calculator/date'

// Shared M3 data table for match lists. Both group matches and knockout
// matches render the same six-column shape; only the first column's header +
// value differ (group number vs. round size). Extracted from the two tabs per
// the standards review to kill the duplicated table markup.
const props = defineProps<{
  matches: Match[]
  entries: { name?: string }[]
  /** First-column header label. */
  firstColumnLabel: string
  /** Extractor for the first-column cell value from each match. */
  firstColumnValue: (match: Match) => string | number
}>()
</script>

<template>
  <div class="overflow-x-auto rounded-lg border border-outline-variant elevation-1">
    <table class="min-w-full border-collapse">
      <thead class="sticky top-0 z-10 bg-surface-container-high">
        <tr>
          <th scope="col" class="whitespace-nowrap px-4 py-3 text-left label-medium text-on-surface-variant uppercase">{{ props.firstColumnLabel }}</th>
          <th scope="col" class="whitespace-nowrap px-4 py-3 text-left label-medium text-on-surface-variant uppercase">Table</th>
          <th scope="col" class="whitespace-nowrap px-4 py-3 text-left label-medium text-on-surface-variant uppercase">Date</th>
          <th scope="col" class="whitespace-nowrap px-4 py-3 text-left label-medium text-on-surface-variant uppercase">Time</th>
          <th scope="col" class="whitespace-nowrap px-4 py-3 text-left label-medium text-on-surface-variant uppercase">Player 1</th>
          <th scope="col" class="whitespace-nowrap px-4 py-3 text-left label-medium text-on-surface-variant uppercase">Player 2</th>
        </tr>
      </thead>
      <tbody class="bg-surface divide-y divide-outline-variant">
        <tr
          v-for="match in props.matches"
          :key="match.datetime"
          class="transition-colors duration-short ease-standard hover:bg-surface-container"
        >
          <td class="whitespace-nowrap px-4 py-3 body-medium text-on-surface-variant">{{ props.firstColumnValue(match) }}</td>
          <td class="whitespace-nowrap px-4 py-3 body-medium text-on-surface-variant">{{ match.table }}</td>
          <td class="whitespace-nowrap px-4 py-3 body-medium text-on-surface-variant">{{ formatDate(match.datetime) }}</td>
          <td class="whitespace-nowrap px-4 py-3 body-medium text-on-surface-variant">{{ formatTime(match.datetime) }}</td>
          <td class="whitespace-nowrap px-4 py-3 body-medium text-on-surface font-medium">{{ props.entries[match.entry1Idx]?.name || 'NA' }}</td>
          <td class="whitespace-nowrap px-4 py-3 body-medium text-on-surface font-medium">{{ props.entries[match.entry2Idx]?.name || 'NA' }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
