<script setup lang="ts">
import { tournament } from '@/store/state'
import { computed, onMounted, ref } from 'vue'
import router from '@/router'
import GroupMatchesTab from '@/components/GroupMatchesTab.vue'
import GroupsTab from '@/components/GroupsTab.vue'
import KnockoutMatchesTab from '@/components/KnockoutMatchesTab.vue'

const props = defineProps({
  shortName: {
    type: String,
    required: true
  }
})

const category = computed(() => {
  return tournament.value.categories.find((c) => c.shortName === props.shortName)
})

// Track active tab
const activeTab = ref('table') // 'table', 'groups', 'knockouts'

const tabs = [
  { name: 'table', label: 'Group Matches' },
  { name: 'groups', label: 'Groups' },
  { name: 'knockouts', label: 'Knockout Matches' }
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
          <button
            v-for="(tab, index) in tabs"
            :key="index"
            class="flex flex-auto justify-center border-b-0 rounded-t-2 border-solid px-1 py-2 text-sm font-medium"
            :class="[
              activeTab === tab.name
                ? 'border-lime-500 bg-lime-50 text-lime-700'
                : 'border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-700 hover:border-lime-400'
            ]"
            @click="activeTab = tab.name"
          >
            <span>{{ tab.label }}</span>
          </button>
        </div>
      </div>

      <!-- Tab content -->
      <div class="h-full overflow-y-auto border border-gray-200 rounded-b-lg bg-white shadow-md">
        <!-- Table View Tab -->
        <GroupMatchesTab v-if="activeTab === 'table'" :category="category" />

        <!-- Knockout View Tab -->
        <KnockoutMatchesTab v-if="activeTab === 'knockouts'" :category="category" />

        <!-- Group View Tab -->
        <GroupsTab v-if="activeTab === 'groups'" :category="category" />
      </div>
    </div>
  </main>
</template>
