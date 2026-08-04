<script setup lang="ts">
import { tournament } from '@/store/state'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import GroupMatchesTab from '@/features/matches/ui/GroupMatchesTab.vue'
import GroupsTab from '@/features/matches/ui/GroupsTab.vue'
import KnockoutMatchesTab from '@/features/matches/ui/KnockoutMatchesTab.vue'

const props = defineProps({
  shortName: {
    type: String,
    required: true
  }
})

const router = useRouter()

const category = computed(() => {
  return tournament.value.categories.find((c) => c.shortName === props.shortName)
})

// Track active tab
const activeTab = ref('table') // 'table', 'groups', 'knockouts'

const tabs = [
  { name: 'table', label: 'Group Matches' },
  { name: 'groups', label: 'Groups' },
  { name: 'knockouts', label: 'Knockout' }
]

onMounted(() => {
  if (!category.value) {
    router.push('/tournament')
  }
})
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <!-- App bar (decision 01): back to setup, brand + context -->
    <header class="sticky top-0 z-20 flex items-center gap-2 px-4 py-3 elevation-1 bg-surface-container">
      <button
        @click="router.push('/tournament')"
        title="Back to tournament"
        class="flex h-10 w-10 items-center justify-center rounded-full border-0 bg-transparent text-on-surface-variant transition-all duration-short ease-standard hover:bg-surface-container-high hover:text-on-surface cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span class="i-line-md-arrow-left text-xl"></span>
      </button>
      <span class="text-xl">🏆</span>
      <div class="flex min-w-0 flex-col">
        <span class="title-medium text-on-surface truncate">{{ category?.name }}</span>
        <span class="body-small text-on-surface-variant truncate">{{ tournament.name }}</span>
      </div>
    </header>

    <main class="mx-auto w-full max-w-[1600px] flex-1 px-6 py-6">
      <!-- M3 tabs -->
      <div class="mb-0 flex gap-1 border-b border-outline-variant">
        <button
          v-for="(tab, index) in tabs"
          :key="index"
          class="relative border-0 border-b-3 border-solid bg-transparent px-5 py-3 title-small transition-colors duration-short ease-standard cursor-pointer outline-none"
          :class="[
            activeTab === tab.name
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
          ]"
          @click="activeTab = tab.name"
        >
          <span>{{ tab.label }}</span>
        </button>
      </div>

      <!-- Tab content -->
      <div class="mt-4 rounded-b-lg">
        <!-- Table View Tab -->
        <GroupMatchesTab v-if="activeTab === 'table'" :category="category" />

        <!-- Knockout View Tab -->
        <KnockoutMatchesTab v-if="activeTab === 'knockouts'" :category="category" />

        <!-- Group View Tab -->
        <GroupsTab v-if="activeTab === 'groups'" :category="category" />
      </div>
    </main>
  </div>
</template>
