<template>
  <div class="p-4">
    <h1 class="text-2xl font-bold mb-4">Schedule</h1>
    <GridTable :rowCount="10" :columnCount="8" :grid="myGrid" @update:grid="updatedGrid" />
    <button @click="logGrid">Log Grid</button>
  </div>
</template>

<script setup lang="ts">
import GridTable from '@/widgets/GridTable.vue'
import { ref } from 'vue'

function updatedGrid(newGrid: string[][]) {
  myGrid.value = newGrid
}
const myGrid = ref([
  ['A', '', ''],
  ['', 'B', ''],
  ['', '', 'C']
])

const logGrid = () => {
  console.log(myGrid.value)
}
</script>
