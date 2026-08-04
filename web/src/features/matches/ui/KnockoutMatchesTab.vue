<script setup lang="ts">
import { computed } from 'vue'
import { type Match, EntryByeIdx, EntryEmptyIdx } from '@/types/types'
import { formatDate, formatTime } from '@/calculator/date'
import { roundName } from '@/features/matches/domain/roundName'
import MatchesTable from '@/widgets/MatchesTable.vue'

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

// Rounds for the bracket view, largest-first (as stored).
const bracketRounds = computed(() => props.category?.knockoutRounds ?? [])

function entryName(idx: number): string {
  if (idx === EntryByeIdx) return 'BYE'
  if (idx === EntryEmptyIdx) return '—'
  return props.category?.entries[idx]?.name || 'NA'
}

function isSlotEmpty(idx: number): boolean {
  return idx === EntryEmptyIdx || idx === EntryByeIdx
}
</script>

<template>
  <div class="space-y-6">
    <!-- Visual bracket: rounds as columns of match cards -->
    <div v-if="bracketRounds.length > 0" class="overflow-x-auto pb-2">
      <div class="flex gap-6 min-w-fit">
        <div
          v-for="(kRound, rIdx) in bracketRounds"
          :key="rIdx"
          class="flex flex-col"
        >
          <h4 class="title-small text-on-surface-variant uppercase tracking-wide mb-3 text-center">
            {{ roundName(kRound.round) }}
          </h4>
          <div class="flex flex-col gap-2 flex-1">
            <div
              v-for="(match, mIdx) in kRound.matches"
              :key="mIdx"
              class="rounded-md border border-outline-variant bg-surface elevation-1 px-3 py-2 w-52"
              :class="{ 'opacity-60': isSlotEmpty(match.entry1Idx) && isSlotEmpty(match.entry2Idx) }"
            >
              <div class="flex items-center justify-between gap-2">
                <span
                  class="body-medium truncate"
                  :class="isSlotEmpty(match.entry1Idx) ? 'text-on-surface-variant' : 'text-on-surface font-medium'"
                >{{ entryName(match.entry1Idx) }}</span>
              </div>
              <div class="my-1 h-px bg-outline-variant"></div>
              <div class="flex items-center justify-between gap-2">
                <span
                  class="body-medium truncate"
                  :class="isSlotEmpty(match.entry2Idx) ? 'text-on-surface-variant' : 'text-on-surface font-medium'"
                >{{ entryName(match.entry2Idx) }}</span>
              </div>
              <div v-if="match.table || match.datetime" class="mt-2 body-small text-on-surface-variant">
                <span v-if="match.table">{{ match.table }}</span>
                <span v-if="match.table && match.datetime"> · </span>
                <span v-if="match.datetime">{{ formatDate(match.datetime) }} {{ formatTime(match.datetime) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="knockoutMatches.length === 0" class="flex flex-col items-center gap-3 rounded-lg border border-dashed border-outline-variant bg-surface-container-low px-6 py-12 text-center">
      <span class="text-4xl opacity-40">🏆</span>
      <p class="body-medium text-on-surface-variant">No knockout bracket yet — complete the group stage draw to generate the bracket.</p>
    </div>

    <!-- Data table: the accessible / detailed view, and the test contract.
         tbody > tr with the round number as the first cell. -->
    <MatchesTable
      v-if="knockoutMatches.length > 0"
      :matches="knockoutMatches"
      :entries="props.category?.entries ?? []"
      first-column-label="Round"
      :first-column-value="(m: Match) => m.round!"
    />
  </div>
</template>
