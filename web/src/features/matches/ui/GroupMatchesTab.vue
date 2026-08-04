<script setup lang="ts">
import { computed } from 'vue'
import { type Match } from '@/types/types'
import MatchesTable from '@/widgets/MatchesTable.vue'

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
    return a.table.localeCompare(b.table, undefined, { numeric: true, sensitivity: 'base' })
  })
})
</script>

<template>
  <div>
    <div v-if="groupMatches.length === 0" class="flex flex-col items-center gap-3 rounded-lg border border-dashed border-outline-variant bg-surface-container-low px-6 py-12 text-center">
      <span class="text-4xl opacity-40">⚔️</span>
      <p class="body-medium text-on-surface-variant">No group matches yet — complete the draw to generate the round-robin schedule.</p>
    </div>
    <MatchesTable
      v-else
      :matches="groupMatches"
      :entries="props.category?.entries ?? []"
      first-column-label="Group"
      :first-column-value="(m: Match) => m.groupIdx!"
    />
  </div>
</template>
