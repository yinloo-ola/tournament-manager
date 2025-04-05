<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { EntryType, type LineupItem, type Category } from '@/types/types'
import LabeledInput from '../widgets/LabeledInput.vue'
import LabeledSelect from '../widgets/LabeledSelect.vue'
import SimpleButton from '@/widgets/SimpleButton.vue'
import OutlinedButton from '@/widgets/OutlinedButton.vue'

const props = defineProps<{
  modelValue: boolean
  category: Category
}>()

const emit = defineEmits(['update:modelValue', 'save'])

// Create local copies of the data to prevent automatic reactivity
const lineup = ref<LineupItem[]>([])
const maxPlayers = ref(0)
const ageRequirementType = ref<string[]>([])

// Initialize local data when modal opens or category changes
function initializeLocalData() {
  if (props.category.lineup && props.category.lineup.length > 0) {
    lineup.value = JSON.parse(JSON.stringify(props.category.lineup))
    // Initialize ageRequirementType array based on lineup
    ageRequirementType.value = lineup.value.map((item) =>
      item.ageRequirement ? item.ageRequirement.type : ''
    )
  } else {
    lineup.value = []
    ageRequirementType.value = []
  }
  maxPlayers.value = props.category.maxPlayers || 5
}

// Initialize data when modal opens or category changes
watch(
  [() => props.modelValue, () => props.category],
  ([newModelValue]) => {
    if (newModelValue) {
      initializeLocalData()
    }
  },
  { immediate: true }
)

const minPlayersRequired = computed(() => {
  // Calculate minimum players required based on lineup
  const playerCounts = new Map<string, number>()

  lineup.value.forEach((item) => {
    if (item.matchType === EntryType.Singles) {
      if (item.genderRequirement === 'M') {
        playerCounts.set('M', (playerCounts.get('M') || 0) + 1)
      } else if (item.genderRequirement === 'F') {
        playerCounts.set('F', (playerCounts.get('F') || 0) + 1)
      } else {
        // For 'Any' or 'Mixed' in singles, we need at least one player
        playerCounts.set('Any', (playerCounts.get('Any') || 0) + 1)
      }
    } else if (item.matchType === EntryType.Doubles) {
      if (item.genderRequirement === 'M') {
        playerCounts.set('M', (playerCounts.get('M') || 0) + 2)
      } else if (item.genderRequirement === 'F') {
        playerCounts.set('F', (playerCounts.get('F') || 0) + 2)
      } else if (item.genderRequirement === 'Mixed') {
        playerCounts.set('M', (playerCounts.get('M') || 0) + 1)
        playerCounts.set('F', (playerCounts.get('F') || 0) + 1)
      } else {
        // For 'Any' in doubles, we need at least two players
        playerCounts.set('Any', (playerCounts.get('Any') || 0) + 2)
      }
    }
  })

  // Calculate total minimum players needed
  let total = 0
  playerCounts.forEach((count) => {
    total += count
  })

  return Math.max(1, total) // Ensure at least 1 player is required
})

// Ensure maxPlayers is always >= minPlayersRequired
watch(minPlayersRequired, (newMinPlayers) => {
  if (maxPlayers.value < newMinPlayers) {
    maxPlayers.value = newMinPlayers
  }
})

// Get background color for lineup item based on index
function getLineupItemColor(index: number) {
  const colors = [
    'bg-blue-50 border-blue-200',
    'bg-green-50 border-green-200',
    'bg-yellow-50 border-yellow-200',
    'bg-purple-50 border-purple-200',
    'bg-pink-50 border-pink-200',
    'bg-indigo-50 border-indigo-200',
    'bg-orange-50 border-orange-200'
  ]
  return colors[index % colors.length]
}

function addLineupItem() {
  lineup.value.push({
    name: `Match ${lineup.value.length + 1}`,
    matchType: EntryType.Singles,
    genderRequirement: 'Any'
  })
  ageRequirementType.value.push('')
}

function removeLineupItem(index: number) {
  lineup.value.splice(index, 1)
  ageRequirementType.value.splice(index, 1)
}

function saveLineup() {
  // Ensure maxPlayers is at least equal to minPlayersRequired
  if (maxPlayers.value < minPlayersRequired.value) {
    maxPlayers.value = minPlayersRequired.value
  }

  // Send a deep copy of the lineup to prevent reactivity issues
  emit('save', {
    lineup: JSON.parse(JSON.stringify(lineup.value)),
    maxPlayers: maxPlayers.value
  })
  emit('update:modelValue', false)
}

function cancel() {
  // Just close the modal without saving changes
  emit('update:modelValue', false)
  // The next time the modal opens, it will reinitialize with the original data
}
</script>

<template>
  <div
    v-if="modelValue"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
    @click.self="emit('update:modelValue', false)"
  >
    <div class="relative max-w-2xl w-full border border-gray-300 rounded-lg bg-white p-6 shadow-xl">
      <button
        @click="cancel"
        class="absolute right-2 top-2 z-10 rounded-full border-none p-1.5 text-gray-500 transition-all duration-200 active:scale-95 hover:bg-gray-200 hover:text-gray-700"
      >
        <div class="i-line-md-close h-5 w-5"></div>
      </button>
      <h2 class="mb-4 text-xl font-bold">Team Lineup Configuration</h2>

      <div class="mb-4 flex flex-col md:flex-row md:items-start md:gap-6">
        <div class="w-full md:w-1/2">
          <LabeledInput
            name="maxPlayers"
            label="Max Players Per Team"
            type="number"
            v-model.number="maxPlayers"
            :min="minPlayersRequired"
          />
        </div>
        <div class="w-full md:w-1/2">
          <LabeledInput
            name="minPlayers"
            label="Min Players Per Team (calculated)"
            type="number"
            readonly
            v-model.number="minPlayersRequired"
          />
        </div>
      </div>

      <div class="mb-4">
        <h3 class="mb-2 font-semibold">Match Lineup</h3>
        <div v-if="lineup.length === 0" class="mb-2 text-gray-500">
          No matches defined. Add matches to configure the team lineup.
        </div>

        <div class="max-h-96 overflow-y-auto pr-2">
          <div
            v-for="(item, index) in lineup"
            :key="index"
            :class="[
              'mb-4 border rounded-lg p-3 shadow-sm hover:shadow-md transition-all duration-200 relative',
              getLineupItemColor(index)
            ]"
          >
            <button
              @click="removeLineupItem(index)"
              class="absolute right-2 top-2 rounded-full border-none p-1.5 text-gray-500 transition-all duration-200 active:scale-95 hover:bg-gray-200 hover:text-red-600"
            >
              <div class="i-line-md-close h-5 w-5" />
            </button>

            <div class="grid grid-cols-1 mt-2 gap-3 md:grid-cols-2">
              <LabeledInput
                :name="`matchName-${index}`"
                label="Match Name"
                type="text"
                v-model="item.name"
              />

              <LabeledSelect
                :name="`matchType-${index}`"
                label="Match Type"
                :options="[
                  { value: EntryType.Singles, label: 'Singles' },
                  { value: EntryType.Doubles, label: 'Doubles' }
                ]"
                v-model="item.matchType"
              />

              <LabeledSelect
                :name="`genderRequirement-${index}`"
                label="Gender Requirement"
                :options="[
                  { value: 'Any', label: 'Any Gender' },
                  { value: 'M', label: 'Male Only' },
                  { value: 'F', label: 'Female Only' },
                  { value: 'Mixed', label: 'Mixed (Male & Female)' }
                ]"
                v-model="item.genderRequirement"
              />

              <div class="flex flex-col">
                <LabeledSelect
                  :name="`ageRequirementType-${index}`"
                  label="Age Requirement"
                  :options="[
                    { value: '', label: 'No Age Requirement' },
                    { value: 'minimum', label: 'Minimum Age' },
                    { value: 'maximum', label: 'Maximum Age' }
                  ]"
                  v-model="ageRequirementType[index]"
                  @update:modelValue="
                    (val) => {
                      if (!val) {
                        item.ageRequirement = undefined
                      } else if (!item.ageRequirement) {
                        item.ageRequirement = {
                          type: val as 'minimum' | 'maximum',
                          value: 0
                        }
                      } else {
                        item.ageRequirement.type = val as 'minimum' | 'maximum'
                      }
                    }
                  "
                />

                <LabeledInput
                  v-if="item.ageRequirement"
                  :name="`ageRequirementValue-${index}`"
                  :label="`Age Value (${item.ageRequirement.type === 'minimum' ? 'min' : 'max'})`"
                  type="number"
                  v-model.number="item.ageRequirement.value"
                />
              </div>
            </div>
          </div>
        </div>

        <SimpleButton
          @click="addLineupItem"
          class="mt-2 h-10 w-full rounded-lg bg-blue-100 text-center text-blue-700 hover:bg-blue-200 hover:shadow-lg"
        >
          Add Match
        </SimpleButton>
      </div>

      <div class="mt-6 flex justify-end space-x-3">
        <OutlinedButton
          @click="cancel"
          class="h-10 border border-0 rounded-lg px-4 text-center text-gray-700 hover:bg-gray-100"
        >
          Cancel
        </OutlinedButton>
        <SimpleButton
          @click="saveLineup"
          :disabled="maxPlayers < minPlayersRequired"
          :class="{
            'h-10 rounded-lg bg-blue-600 px-4 text-center text-white hover:bg-blue-700 hover:shadow-lg':
              maxPlayers >= minPlayersRequired,
            'h-10 rounded-lg bg-gray-400 px-4 text-center text-white cursor-not-allowed':
              maxPlayers < minPlayersRequired
          }"
        >
          Save
        </SimpleButton>
      </div>
    </div>
  </div>
</template>
