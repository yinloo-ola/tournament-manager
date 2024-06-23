<script setup lang="ts">
import { ref } from 'vue'
import CategoryCard from '../components/CategoryCard.vue'
import TournamentInfo from '../components/TournamentInfo.vue'
import Draw from '../components/Draw.vue'
import SimpleButton from '../widgets/SimpleButton.vue'
import type { Tournament } from '@/types/types'

let tournament = ref<Tournament>({
  name: '',
  categories: [
    {
      name: '',
      playersPerGrpMain: 3,
      playersPerGrpRemainder: 4,
      players: [],
      groups: []
    }
  ]
})

function addCategory() {
  tournament.value.categories.push({
    name: '',
    playersPerGrpMain: 3,
    playersPerGrpRemainder: 4,
    players: [],
    groups: []
  })
}

let drawIndex = ref(-1)
function startDraw(idx: number) {
  let diff =
    tournament.value.categories[idx].playersPerGrpMain -
    tournament.value.categories[idx].playersPerGrpRemainder
  if (Math.abs(diff) != 1) {
    alert(
      'Difference between "Players Per Group (Main)" and "Players Per Group (Remainder)" should be 1'
    )
    return
  }
  drawIndex.value = idx
}
</script>

<template>
  <main class="flex flex-col">
    <header class="flex justify-between bg-lime-200 py-3 shadow-xl">
      <div class="px-4 text-2xl text-gray-800">
        Tournament Manager <span class="px-4 font-black">{{ tournament.name }}</span>
      </div>
      <div class="flex gap-x-4 px-4">
        <SimpleButton class="bg-lime-700 text-white"> EXPORT </SimpleButton>
      </div>
    </header>

    <div class="flex flex-col">
      <div class="flex flex-col gap-3 p-4">
        <TournamentInfo v-model="tournament" @addCategory="addCategory"></TournamentInfo>
      </div>

      <div
        class="grid gap-4 px-4 2xl:grid-cols-5 lg:grid-cols-3 md:grid-cols-2 sm:grid-cols-1 xl:grid-cols-4"
      >
        <template v-for="(category, i) in tournament.categories" :key="i">
          <CategoryCard
            v-model="tournament.categories[i]"
            @remove="tournament.categories.splice(i, 1)"
            @playersImported="(players) => (tournament.categories[i].players = players)"
            @startDraw="startDraw(i)"
          ></CategoryCard>
        </template>
      </div>
    </div>
    <div v-if="drawIndex >= 0" class="fixed inset-2 bg-blue-200 rounded-lg shadow-xl">
      <Draw :category="tournament.categories[drawIndex]" @close="() => (drawIndex = -1)"></Draw>
    </div>
  </main>
</template>

<style></style>
