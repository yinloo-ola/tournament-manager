<script setup lang="ts">
import { ref, computed, watch } from 'vue'

interface CellCoordinates {
  row: number
  col: number
}

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
const selectedCells = ref<CellCoordinates[]>([])
const draggedCells = ref<CellCoordinates[] | null>(null)
let isDragging = false

const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${props.columnCount}, 1fr)`
}))

const initializeGrid = () => {
  const newGrid: string[][] = []
  for (let i = 0; i < props.rowCount; i++) {
    newGrid.push(Array(props.columnCount).fill(''))
  }
  for (let i = 0; i < props.grid.length && i < props.rowCount; i++) {
    for (let j = 0; j < props.grid[i].length && j < props.columnCount; j++) {
      newGrid[i][j] = props.grid[i][j]
    }
  }
  gridLocal.value = newGrid
}

watch(() => [props.rowCount, props.columnCount, props.grid], initializeGrid, { immediate: true })

const handleCellClick = (rowIndex: number, colIndex: number, event: MouseEvent) => {
  if (!event.shiftKey) {
    selectedCells.value = [{ row: rowIndex, col: colIndex }]
  } else {
    if (selectedCells.value.length > 0 && selectedCells.value[0].row === rowIndex) {
      const startCol = Math.min(selectedCells.value[0].col, colIndex)
      const endCol = Math.max(selectedCells.value[0].col, colIndex)
      const newSelectedCells: CellCoordinates[] = []
      for (let i = startCol; i <= endCol; i++) {
        newSelectedCells.push({ row: rowIndex, col: i })
      }
      selectedCells.value = newSelectedCells
    } else {
      selectedCells.value = [{ row: rowIndex, col: colIndex }]
    }
  }
}

const handleDragStart = (event: DragEvent, rowIndex: number, colIndex: number) => {
  const cell = { row: rowIndex, col: colIndex }
  if (
    selectedCells.value.some(
      (selectedCell) => selectedCell.row === cell.row && selectedCell.col === cell.col
    )
  ) {
    isDragging = true
    draggedCells.value = selectedCells.value.sort((a, b) => a.col - b.col)
    event.dataTransfer?.setData('text/plain', '')
  } else {
    event.preventDefault()
  }
}

const handleDragEnd = () => {
  isDragging = false
  draggedCells.value = null
}

const handleDrop = (event: DragEvent, row: number, col: number) => {
  event.preventDefault()

  if (!isDragging || !draggedCells.value || draggedCells.value.length === 0) return

  let dropRow = row
  let dropCol = col

  const updatedGrid = JSON.parse(JSON.stringify(gridLocal.value))

  // Null check for draggedCells.value and add type annotation for cell
  const canFit = draggedCells.value!.every((cell: CellCoordinates) => {
    const targetCol = dropCol + (cell.col - draggedCells.value![0].col)
    return targetCol >= 0 && targetCol < props.columnCount && updatedGrid[dropRow][targetCol] === ''
  })

  if (!canFit) return

  const draggedData: string[] = []

  // Null check for draggedCells.value and add type annotation for cell
  for (let i = 0; i < draggedCells.value!.length; i++) {
    const cell: CellCoordinates = draggedCells.value![i]
    draggedData.push(updatedGrid[cell.row][cell.col])
    updatedGrid[cell.row][cell.col] = ''
  }

  // Null check for draggedCells.value and add type annotation for cell
  for (let i = 0; i < draggedCells.value!.length; i++) {
    const cell: CellCoordinates = draggedCells.value![i]
    const targetCol = dropCol + (cell.col - draggedCells.value![0].col)
    updatedGrid[dropRow][targetCol] = draggedData[i]
  }

  gridLocal.value = updatedGrid
  emit('update:grid', updatedGrid)

  // Null check for draggedCells.value and add type annotation for cell
  selectedCells.value = draggedCells.value!.map((cell: CellCoordinates) => ({
    row: dropRow,
    col: dropCol + (cell.col - draggedCells.value![0].col)
  }))

  draggedCells.value = null
}

const isCellSelected = (rowIndex: number, colIndex: number) => {
  return selectedCells.value.some((cell) => cell.row === rowIndex && cell.col === colIndex)
}
</script>

<template>
  <div class="grid-container" :style="gridStyle">
    <div v-for="(row, rowIndex) in gridLocal" :key="rowIndex" class="grid-row">
      <div
        v-for="(cell, colIndex) in row"
        :key="colIndex"
        class="grid-cell"
        :class="{ 'selected-cell': isCellSelected(rowIndex, colIndex) }"
        draggable="true"
        @click="handleCellClick(rowIndex, colIndex, $event)"
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
  display: contents;
}

.grid-cell {
  border: 1px solid #ccc;
  padding: 20px;
  text-align: center;
  min-height: 50px;
  cursor: pointer;
}

.grid-cell[draggable='true'] {
  cursor: move;
}

.selected-cell {
  background-color: lightblue;
}
</style>
