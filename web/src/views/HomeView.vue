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

const router = useRouter()
const recents = ref<RecentEntry[]>([])
const errorMessage = ref('')

async function reloadRecents() {
  recents.value = await listRecents()
}

onMounted(reloadRecents)

async function importTournament() {
  errorMessage.value = ''
  try {
    await openTournamentFromFile(pickOpenSource())
    await reloadRecents()
    router.push('/tournament')
  } catch (e) {
    if (e instanceof OpenFileError) errorMessage.value = e.message
    else throw e
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
  const source: FileSource = openFromHandleSource(entry.fileHandle, entry.name)
  try {
    await openTournamentFromFile(source)
    router.push('/tournament')
  } catch (e) {
    if (e instanceof OpenFileError) errorMessage.value = e.message
    else throw e
  }
}
</script>

<template>
  <main
    class="h-screen w-screen flex flex-col items-center justify-center gap-y-6 px-4"
  >
    <div class="flex flex-col items-stretch gap-y-6 lg:w-1/3">
      <button
        @click="importTournament"
        class="cursor-pointer border-0 rounded-lg bg-lime-600 px-5 py-3 text-[15px] text-white shadow-gray-500/50 shadow-lg active:scale-[.97]"
      >
        Import Tournament
      </button>
      <button
        @click="createNew"
        data-test="create-new"
        class="cursor-pointer border-0 rounded-lg bg-lime-800 px-5 py-3 text-[15px] text-white shadow-gray-500/50 shadow-lg active:scale-[.97]"
      >
        Create New Tournament
      </button>
    </div>

    <p v-if="errorMessage" data-test="error" class="text-red-600">{{ errorMessage }}</p>

    <section v-if="recents.length" data-test="recents" class="w-full lg:w-1/3">
      <h2 class="mb-2 font-semibold">Recent tournaments</h2>
      <ul class="flex flex-col gap-y-2">
        <li
          v-for="r in recents"
          :key="r.id"
          class="flex items-center justify-between rounded-md border border-gray-300 px-3 py-2"
        >
          <span class="truncate">{{ r.name }}</span>
          <span class="flex shrink-0 gap-x-3">
            <button
              @click="onOpenRecent(r)"
              :disabled="!r.fileHandle"
              class="cursor-pointer text-sm text-lime-700 disabled:cursor-not-allowed disabled:text-gray-400"
            >
              Open
            </button>
            <button
              data-test="recent-remove"
              @click="onRemoveRecent(r.id)"
              class="cursor-pointer text-sm text-red-600"
            >
              Remove
            </button>
          </span>
        </li>
      </ul>
    </section>
  </main>
</template>
