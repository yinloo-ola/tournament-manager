<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { tournament, newTournament, currentFileHandle } from '@/app/documentStore'
import {
  listRecents,
  removeRecent,
  type RecentEntry
} from '@/features/tournament-doc/storage/recents'
import {
  openTournamentFromFile,
  OpenFileError,
  type FileSource
} from '@/features/tournament-doc/openDocument'
import { pickOpenSource, openFromHandleSource } from '@/features/tournament-doc/storage/fileAccess'
import SimpleButton from '@/widgets/SimpleButton.vue'
import OutlinedButton from '@/widgets/OutlinedButton.vue'
import { relativeTimeFromNow } from '@/calculator/date'

const router = useRouter()
const recents = ref<RecentEntry[]>([])
const errorMessage = ref('')
const importing = ref(false)

async function reloadRecents() {
  recents.value = await listRecents()
}

onMounted(reloadRecents)

async function importTournament() {
  errorMessage.value = ''
  importing.value = true
  try {
    await openTournamentFromFile(pickOpenSource())
    await reloadRecents()
    router.push('/tournament')
  } catch (e) {
    if (e instanceof OpenFileError) errorMessage.value = e.message
    else throw e
  } finally {
    importing.value = false
  }
}

function createNew() {
  tournament.value = newTournament()
  currentFileHandle.value = null
  router.push('/tournament')
}

async function onRemoveRecent(id: string) {
  await removeRecent(id)
  await reloadRecents()
}

async function onOpenRecent(entry: RecentEntry) {
  if (!entry.fileHandle) {
    errorMessage.value = `"${entry.name}" was imported without file access and can't be reopened here — please re-import it.`
    return
  }
  errorMessage.value = ''
  try {
    await openTournamentFromFile(openFromHandleSource(entry.fileHandle, entry.name))
    router.push('/tournament')
  } catch (e) {
    if (e instanceof OpenFileError) errorMessage.value = e.message
    else throw e
  }
}

// relativeTimeFromNow lives in @/calculator/date (moved from this view per the
// standards review — presentation date helpers belong with the rest).
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <!-- App bar (decision 01): brand only, no document actions on the launcher -->
    <header class="sticky top-0 z-20 flex items-center gap-2 px-4 py-3 elevation-1 bg-surface-container">
      <span class="text-xl">🏆</span>
      <span class="title-large text-primary">Tournament Manager</span>
    </header>

    <!-- Launcher content: hero + CTAs + recents -->
    <main class="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-12">
      <!-- Hero / branding -->
      <section class="mb-10 text-center">
        <div class="mb-4 text-6xl">🏆</div>
        <h1 class="display-small mb-2 text-on-surface">Tournament Manager</h1>
        <p class="body-medium text-on-surface-variant">
          Round-robin groups &amp; knockout brackets for racquet sports
        </p>
      </section>

      <!-- Primary actions: Import (filled) + Create (outlined) -->
      <section class="mb-2 flex flex-col gap-3 sm:flex-row">
        <SimpleButton
          variant="filled"
          @click="importTournament"
          :disabled="importing"
          class="flex-1 !h-12"
        >
          <span class="i-line-md-folder-open"></span>
          <span class="label-large">{{ importing ? 'Opening…' : 'Import Tournament' }}</span>
        </SimpleButton>
        <OutlinedButton
          tone="primary"
          @click="createNew"
          data-test="create-new"
          class="flex-1 !h-12"
        >
          <span class="i-line-md-plus"></span>
          <span class="label-large">Create New Tournament</span>
        </OutlinedButton>
      </section>

      <!-- Inline error (replaces nothing when empty; full toast system is ticket 07) -->
      <p
        v-if="errorMessage"
        data-test="error"
        class="mt-4 rounded-md bg-error-container px-4 py-3 body-medium text-on-error-container"
      >
        {{ errorMessage }}
      </p>

      <!-- Recent tournaments, or empty state -->
      <section class="mt-12">
        <h2 class="label-large mb-4 text-on-surface-variant">Recent tournaments</h2>

        <!-- Empty state (decision 01: surface it instead of hiding the section) -->
        <div
          v-if="recents.length === 0"
          class="flex flex-col items-center gap-3 rounded-lg border border-dashed border-outline-variant bg-surface-container-low px-6 py-12 text-center"
        >
          <span class="text-4xl opacity-40">📄</span>
          <p class="body-medium text-on-surface-variant">
            No tournaments yet — import a file or create a new one to get started.
          </p>
        </div>

        <!-- Recents list -->
        <ul v-else class="flex flex-col gap-2">
          <li
            v-for="r in recents"
            :key="r.id"
            class="group flex items-center gap-3 rounded-md bg-surface-container px-4 py-3 elevation-1 transition-all duration-short ease-standard hover:elevation-2"
          >
            <span class="text-xl text-primary opacity-70">📄</span>
            <button
              @click="onOpenRecent(r)"
              :disabled="!r.fileHandle"
              :title="!r.fileHandle ? 'Re-import this file — it was opened without file access' : `Open ${r.name}`"
              class="flex flex-1 flex-col items-start gap-0.5 bg-transparent border-0 cursor-pointer text-left disabled:cursor-not-allowed outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xs px-1"
            >
              <span class="title-medium text-on-surface group-disabled:opacity-50 truncate w-full text-left">{{ r.name }}</span>
              <span class="body-small text-on-surface-variant">
                {{ relativeTimeFromNow(r.lastModified) }}
                <span v-if="r.sourceKind === 'downloaded'" class="text-on-surface-variant/60">· download</span>
              </span>
            </button>
            <button
              data-test="recent-remove"
              @click="onRemoveRecent(r.id)"
              title="Remove from recents"
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-0 bg-transparent text-on-surface-variant opacity-0 transition-all duration-short ease-standard hover:bg-error-container hover:text-on-error-container focus:opacity-100 group-hover:opacity-100 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span class="i-line-md-close"></span>
            </button>
          </li>
        </ul>
      </section>
    </main>
  </div>
</template>
