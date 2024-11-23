<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'

const props = defineProps({
  rowCount: {
    type: Number,
    default: 3
  },
  columnCount: {
    type: Number,
    default: 3
  },
  grid: {
    type: Array as () => string[][],
    required: true
  }
})

const emit = defineEmits(['update:grid'])

const gridLocal = ref<string[][]>([])

const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${props.columnCount}, 1fr)`
}))

const draggedCell = ref<{ row: number; col: number } | null>(null)

const initializeGrid = () => {
  const newGrid = []
  for (let i = 0; i < props.rowCount; i++) {
    newGrid.push(Array(props.columnCount).fill('')) // Initialize with empty strings
  }
  // Populate with provided data if available, respecting boundaries
  for (let i = 0; i < props.grid.length && i < props.rowCount; i++) {
    for (let j = 0; j < props.grid[i].length && j < props.columnCount; j++) {
      newGrid[i][j] = props.grid[i][j]
    }
  }

  gridLocal.value = newGrid
}

watch(() => [props.rowCount, props.columnCount, props.grid], initializeGrid, { immediate: true })

const handleDragStart = (event: DragEvent, row: number, col: number) => {
  draggedCell.value = { row, col }
  event.dataTransfer?.setData('text/plain', '')
}

const handleDragEnd = () => {
  draggedCell.value = null
}

const handleDrop = (event: DragEvent, row: number, col: number) => {
  event.preventDefault()

  if (draggedCell.value) {
    const updatedGrid = JSON.parse(JSON.stringify(gridLocal.value)) // Deep copy

    if (updatedGrid[row] && updatedGrid[row][col] === '') {
      // Check for valid indices and empty target
      updatedGrid[row][col] = updatedGrid[draggedCell.value.row][draggedCell.value.col]
      updatedGrid[draggedCell.value.row][draggedCell.value.col] = ''
      gridLocal.value = updatedGrid
      emit('update:grid', updatedGrid)
    }
  }
}
</script>

<template>
  <div class="grid-container" :style="gridStyle">
    <div v-for="(row, rowIndex) in gridLocal" :key="rowIndex" class="grid-row">
      <div
        v-for="(cell, colIndex) in row"
        :key="colIndex"
        class="grid-cell"
        draggable="true"
        @drop="handleDrop($event, rowIndex, colIndex)"
        @dragover.prevent
        @dragstart="handleDragStart($event, rowIndex, colIndex)"
        @dragend="handleDragEnd"
      >
        {{ cell }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.grid-container {
  display: grid;
  border: 1px solid #ccc;
}

.grid-row {
  display: contents; /* More efficient than flex for this purpose */
}

.grid-cell {
  border: 1px solid #ccc;
  padding: 20px;
  text-align: center;
  min-height: 50px;
  cursor: move;
}
</style>
