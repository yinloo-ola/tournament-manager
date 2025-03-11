<script setup lang="ts">
import { tournament } from '@/store/state';
import { computed, onMounted, ref } from 'vue';
import router from '@/router'
import type { Match, Group, Player } from '@/types/types';

const props = defineProps({
  shortName: {
    type: String,
    required: true
  }
})

const category = computed(() => {
  return tournament.value.categories.find((c) => c.shortName === props.shortName)
})

const groupMatches = computed(() => {
  let allMatches: Array<Match> = []
  if (category.value?.groups) {
    category.value.groups.forEach((g) => {
      g.rounds.forEach((r) => {
        r.forEach((m) => {
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

// Helper function to get the group for a match
const getGroupForMatch = (match: Match): string => {
  if (category.value?.groups) {
    for (const group of category.value.groups) {
      for (const round of group.rounds) {
        if (round.some(m => m.datetime === match.datetime &&
          m.player1.name === match.player1.name &&
          m.player2.name === match.player2.name)) {
          // Find the group index
          const groupIndex = category.value.groups.indexOf(group) + 1;
          return `Group ${groupIndex}`;
        }
      }
    }
  }
  return 'N/A';
};

// Format date from datetime string in GMT
const formatDate = (datetime: string): string => {
  if (!datetime) return 'TBD';
  const date = new Date(datetime);
  // Convert to GMT date string format
  return date.toUTCString().split(' ').slice(0, 4).join(' ');
};

// Format time from datetime string in GMT
const formatTime = (datetime: string): string => {
  if (!datetime) return 'TBD';
  const date = new Date(datetime);
  // Extract only the time portion in GMT without timezone indicator
  return date.toUTCString().split(' ')[4];
};

// Track active tab
const activeTab = ref('table'); // 'table', 'groups', 'knockouts'

// Get all groups for the current category
const categoryGroups = computed(() => {
  return category.value?.groups || [];
});

// Helper function to get player position in a group
const getPlayerPosition = (group: Group, player: Player): number => {
  // This is a placeholder - in a real app you would calculate position based on points
  return 0
};

// Helper function to get player points in a group
const getPlayerPoints = (group: Group, player: Player): number => {
  // This is a placeholder - in a real app you would calculate points based on match results
  return 0; // Placeholder value
};

// Add knockout matches computed property
const knockoutMatches = computed(() => {
  let allMatches: Array<Match> = []
  if (category.value?.knockoutRounds) {
    category.value.knockoutRounds.forEach((k) => {
      k.matches.forEach((m) => {
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

const tabs = [
  { name: 'table', label: 'Group Matches' },
  { name: 'groups', label: 'Groups' },
  { name: 'knockouts', label: 'Knockout Matches' },
]

onMounted(() => {
  if (!category.value) {
    router.push('/tournament')
  }
})
</script>

<template>
  <main class="h-screen flex flex-col">
    <header class="flex items-center justify-between bg-lime-200 shadow-xl">
      <div class="flex items-center gap-x-4 px-4 py-2">
        <RouterLink :to="`/tournament`" class="flex items-center py-2">
          <div class="i-line-md-arrow-left text-xl text-gray-500 hover:text-gray-600"></div>
        </RouterLink>

        <div class="h-full flex items-center pb-1 text-2xl text-lime-900 font-800 font-black">
          {{ tournament.name }} - {{ category?.name }}
        </div>
      </div>
    </header>
    <div class="flex flex-1 flex-col overflow-hidden p-4">
      <!-- Tab navigation -->
      <div class="mb-0">
        <div class="w-full flex overflow-hidden rounded-t-lg bg-transparent shadow-sm">
          <button v-for="(tab, index) in tabs" :key="index"
            class="flex flex-auto justify-center border-b-0 rounded-t-2 border-solid px-1 py-2 text-sm font-medium"
            :class="[
              activeTab === tab.name
                ? 'border-lime-500 bg-lime-50 text-lime-700'
                : 'border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-700 hover:border-lime-400'
            ]" @click="activeTab = tab.name">
            <span>{{ tab.label }}</span>
          </button>
        </div>
      </div>

      <!-- Tab content -->
      <div class="h-full overflow-y-auto border border-gray-200 rounded-b-lg bg-white shadow-md">
        <!-- Table View Tab -->
        <div v-if="activeTab === 'table'" class="p-4">
          <!-- Add group matches title -->
          <table class="min-w-full border border-lime-200 rounded-lg border-solid divide-y divide-gray-200">
            <thead class="sticky top-0 z-10 border bg-lime-50">
              <tr>
                <th scope="col" class="px-6 py-3 text-left text-xs text-lime-700 font-medium tracking-wider uppercase">
                  Group
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs text-lime-700 font-medium tracking-wider uppercase">
                  Table
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs text-lime-700 font-medium tracking-wider uppercase">
                  Date
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs text-lime-700 font-medium tracking-wider uppercase">
                  Time
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs text-lime-700 font-medium tracking-wider uppercase">
                  Player 1</th>
                <th scope="col" class="px-6 py-3 text-left text-xs text-lime-700 font-medium tracking-wider uppercase">
                  Player 2</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="match in groupMatches" :key="match.datetime"
                class="transition-colors duration-150 hover:bg-lime-50">
                <!-- Extracting group information from the match context -->
                <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                  {{ getGroupForMatch(match) }}
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
                  {{ match.player1.name }}
                </td>
                <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-900 font-medium">
                  {{ match.player2.name }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Knockout View Tab -->
        <div v-if="activeTab === 'knockouts'" class="p-4">
          <table class="min-w-full border border-lime-200 rounded-lg border-solid divide-y divide-gray-200">
            <thead class="sticky top-0 z-10 border bg-lime-50">
              <tr>
                <th scope="col" class="px-6 py-3 text-left text-xs text-lime-700 font-medium tracking-wider uppercase">
                  Round
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs text-lime-700 font-medium tracking-wider uppercase">
                  Table
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs text-lime-700 font-medium tracking-wider uppercase">
                  Date
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs text-lime-700 font-medium tracking-wider uppercase">
                  Time
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs text-lime-700 font-medium tracking-wider uppercase">
                  Player 1</th>
                <th scope="col" class="px-6 py-3 text-left text-xs text-lime-700 font-medium tracking-wider uppercase">
                  Player 2</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="match in knockoutMatches" :key="match.datetime"
                class="transition-colors duration-150 hover:bg-lime-50">
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
                  {{ match.player1.name }}
                </td>
                <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-900 font-medium">
                  {{ match.player2.name }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Group View Tab -->
        <div v-if="activeTab === 'groups'" class="p-4 space-y-8">
          <div v-for="(group, groupIndex) in categoryGroups" :key="groupIndex" class="overflow-x-auto">
            <h3 class="mb-3 flex items-center text-lg text-lime-700 font-semibold">
              Group {{ groupIndex + 1 }}
            </h3>
            <table
              class="min-w-full border border-lime-200 rounded-lg border-solid shadow-sm divide-y divide-gray-200 divide-solid">
              <thead class="bg-lime-50">
                <tr>
                  <th
                    class="border-b border-r border-gray-200 px-4 py-2 text-left text-xs text-gray-500 font-medium tracking-wider uppercase">
                  </th>
                  <th
                    class="border-b border-gray-200 px-4 py-2 text-left text-xs text-gray-500 font-medium tracking-wider uppercase">
                    Player</th>
                  <!-- Generate columns for each player in the group -->
                  <th v-for="(_, playerIndex) in group.players" :key="playerIndex"
                    class="border-b border-r border-gray-200 px-4 py-2 text-center text-xs text-gray-500 font-medium tracking-wider uppercase">
                    {{ playerIndex + 1 }}
                  </th>
                  <th
                    class="border-b border-r border-gray-200 px-4 py-2 text-center text-xs text-gray-500 font-medium tracking-wider uppercase">
                    Points</th>
                  <th
                    class="border-b border-gray-200 px-4 py-2 text-center text-xs text-gray-500 font-medium tracking-wider uppercase">
                    Position</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200 divide-solid">
                <!-- Row for each player in the group -->
                <tr v-for="(player, playerIndex) in group.players" :key="player.name"
                  class="transition-colors duration-150 divide-x divide-gray-200 hover:bg-lime-50">
                  <td class="whitespace-nowrap border-r border-gray-200 px-4 py-2 text-sm text-gray-900 font-medium">
                    {{ playerIndex + 1 }}
                  </td>
                  <td class="whitespace-nowrap border-r border-gray-200 px-4 py-2 text-sm text-gray-900">
                    {{ player.name }} {{ player.club ? `(${player.club})` : '' }}
                  </td>
                  <!-- Cell for each player matchup -->
                  <td v-for="(opponent, opponentIndex) in group.players" :key="opponent.name"
                    class="border-r border-gray-200 px-4 py-2 text-center text-sm text-gray-500"
                    :class="{ 'bg-gray-900': playerIndex === opponentIndex }">
                    <!-- Display match result if not the same player -->
                    <span v-if="playerIndex !== opponentIndex">
                      <!-- This would be replaced with actual match results in a real app -->
                    </span>
                  </td>
                  <td class="whitespace-nowrap border-r border-gray-200 px-4 py-2 text-center text-sm text-gray-900">
                    {{ getPlayerPoints(group, player) }}
                  </td>
                  <td class="whitespace-nowrap px-4 py-2 text-center text-sm text-lime-700 font-medium">
                    {{ getPlayerPosition(group, player) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>