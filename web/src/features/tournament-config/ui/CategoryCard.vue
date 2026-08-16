<script setup lang="ts">
import { computed, ref } from 'vue'
import { readEntryWorkbook, EntryTemplateError } from '@/features/entry/domain/readEntryWorkbook'
import { entryTemplateUrl, entryTemplateFilename } from '@/features/entry/domain/entryTemplate'
import { importSinglesEntries, type EntryLike } from '@/features/entry/domain/importSingles'
import { importDoublesEntries } from '@/features/entry/domain/importDoubles'
import { importTeamEntries } from '@/features/entry/domain/importTeam'
import LabeledInput from '@/widgets/LabeledInput.vue'
import { EntryType } from '@/types/types'
import OutlinedButton from '@/widgets/OutlinedButton.vue'
import LabeledSelect from '@/widgets/LabeledSelect.vue'
import type { Category } from '@/types/types'
import { isGroupEmpty } from '@/features/draw/domain/groups'
import SimpleButton from '@/widgets/SimpleButton.vue'
import router from '@/router'
import { useToast } from '@/shared/ui/toast'

const { toast } = useToast()
const isDebug = ref(false)
const file = ref<HTMLInputElement | null>(null)
async function onFileSelected(event: any) {
  if (event.target.files.length === 0) {
    toast.error('No files selected')
    return
  }

  const selectedFile: File = event.target.files[0]

  // Snapshot entryType + team bounds ONCE, before any await, so the guards,
  // the importer dispatch, and the importer args all use consistent values —
  // a mid-read UI change cannot run the wrong importer (TOCTOU).
  const entryType = category.value.entryType
  const minPlayers = category.value.minPlayers
  const maxPlayers = category.value.maxPlayers

  // Check the category entryType and call the appropriate local importer.
  // Only readWorkbook is async (ExcelJS is Promise-based); the importers are
  // synchronous and throw inside the try/catch, so their Error.message
  // surfaces directly via the toast. Never await the importer — that would
  // turn the throw into an unhandled rejection.
  switch (entryType) {
    case EntryType.Singles:
    case EntryType.Doubles:
    case EntryType.Team: {
      if (entryType === EntryType.Team) {
        if (!minPlayers || !maxPlayers) {
          toast.error('Please set minimum and maximum players for team')
          return
        }
        if (minPlayers < 1 || maxPlayers < 1) {
          toast.error('Minimum and maximum players must be greater than 0')
          return
        }
        if (minPlayers > maxPlayers) {
          toast.error('Minimum players must be less than maximum players')
          return
        }
      }

      try {
        const workbook = await readEntryWorkbook(selectedFile, entryType)
        let data: EntryLike[]
        switch (entryType) {
          case EntryType.Singles:
            data = importSinglesEntries(workbook)
            break
          case EntryType.Doubles:
            data = importDoublesEntries(workbook)
            break
          case EntryType.Team:
            data = importTeamEntries(workbook, minPlayers!, maxPlayers!)
            break
        }
        emit('playersImported', data)
        toast.success(`Imported ${data.length} entries`)
      } catch (error) {
        // Structural problems point at the Entry Template — offer the download
        // as a toast action; data errors (bad row values) explain themselves.
        if (error instanceof EntryTemplateError) {
          toast.error(error.message, {
            actionLabel: 'Download template',
            onAction: downloadEntryTemplate,
            duration: TEMPLATE_ERROR_TOAST_MS
          })
        } else {
          toast.error((error as Error).message)
        }
      }
      break
    }
    default:
      toast.error('Please select an entry type before importing')
      return
  }

  file.value!.value = ''
}

// Structural failures carry a recoverable action — give them twice the
// default snackbar time to be read and clicked.
const TEMPLATE_ERROR_TOAST_MS = 8000

function downloadEntryTemplate() {
  if (!isEntryTypeSelected.value) {
    toast.error('Please select an entry type before importing')
    return
  }
  const anchor = document.createElement('a')
  anchor.href = entryTemplateUrl(category.value.entryType)
  anchor.download = entryTemplateFilename(
    category.value.name,
    category.value.entryType
  )
  anchor.click()
  toast.success('Entry Template downloaded')
}

function playerCountChanged(countType: string) {
  emit('playerCountChanged', countType)
}

const category = defineModel<Category>({
  required: true
})

// Initialize minPlayers and maxPlayers if they don't exist
if (category.value.entryType === EntryType.Team && !category.value.minPlayers) {
  category.value.minPlayers = 3
}
if (category.value.entryType === EntryType.Team && !category.value.maxPlayers) {
  category.value.maxPlayers = 5
}

let canChangePlayersPerGrp = computed(() => isGroupEmpty(category.value.groups))

const emit = defineEmits(['remove', 'playersImported', 'startDraw', 'error', 'playerCountChanged'])

const isEntryTypeSelected = computed(() => {
  return category.value.entryType !== EntryType.Unknown
})

const hasEntries = computed(() => {
  return category.value.entries && category.value.entries.length > 0
})

// shortName is the routing key for the Matches view (it's the :shortName route
// param and the lookup in MatchesView). An empty short name makes the button
// push `/tournament/matches/`, which falls through to the catch-all route and
// dumps the user on the home launcher — so the button must stay disabled until
// a short name is set.
const hasShortName = computed(() => !!category.value.shortName)

// Lifecycle status: a lightweight signal of where this category is in the
// configure → import → draw flow, surfaced on the card so the grid gives the
// user orientation at a glance (was previously invisible).
const lifecycle = computed(() => {
  if (!hasEntries.value) {
    return { label: 'No entries imported', tone: 'pending' as const }
  }
  if (!category.value.groups || isGroupEmpty(category.value.groups)) {
    return { label: `${category.value.entries.length} entries · draw pending`, tone: 'pending' as const }
  }
  return { label: `Draw done · ${category.value.entries.length} entries`, tone: 'done' as const }
})
</script>

<template>
  <div
    data-test="category-card"
    class="relative flex min-w-0 flex-col rounded-lg bg-surface-container-low p-4 elevation-1 transition-all duration-short ease-standard hover:elevation-2"
  >
    <!-- Remove (ghost icon, top-right) -->
    <button
      @click="emit('remove')"
      title="Remove category"
      class="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border-0 bg-transparent text-on-surface-variant opacity-60 transition-all duration-short ease-standard hover:bg-error-container hover:text-on-error-container hover:opacity-100 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <span class="i-line-md-close"></span>
    </button>

    <!-- Lifecycle status chip (the UX win: at-a-glance progress signal) -->
    <div class="mb-3 flex items-center gap-1.5">
      <span
        class="inline-block h-2 w-2 rounded-full"
        :class="lifecycle.tone === 'done' ? 'bg-primary' : 'bg-outline'"
      ></span>
      <span class="body-small text-on-surface-variant">{{ lifecycle.label }}</span>
    </div>

    <LabeledSelect
      name="entryType"
      label="Entry Type"
      :options="[
        { value: 'Singles', label: 'Singles' },
        { value: 'Doubles', label: 'Doubles' },
        { value: 'Team', label: 'Team' }
      ]"
      v-model="category.entryType"
    ></LabeledSelect>
    <LabeledInput
      name="category"
      label="Category"
      type="text"
      v-model="category.name"
    ></LabeledInput>
    <LabeledInput
      name="categoryShort"
      label="Short Form"
      type="text"
      v-model="category.shortName"
    ></LabeledInput>
    <LabeledInput
      name="durationMinutes"
      label="Match Duration (minutes)"
      type="number"
      v-model.number="category.durationMinutes"
    ></LabeledInput>
    <LabeledInput
      v-if="category.entryType === EntryType.Team"
      name="minPlayers"
      label="Min Players Per Team"
      type="number"
      v-model.number="category.minPlayers"
    ></LabeledInput>
    <LabeledInput
      v-if="category.entryType === EntryType.Team"
      name="maxPlayers"
      label="Max Players Per Team"
      type="number"
      v-model.number="category.maxPlayers"
    ></LabeledInput>
    <LabeledInput
      name="numQualifiedPerGroup"
      label="Qualifying Entries Per Group"
      type="number"
      v-model.number="category.numQualifiedPerGroup"
    ></LabeledInput>
    <LabeledInput
      name="players"
      label="Entries Per Group (Main)"
      type="number"
      v-model="category.entriesPerGrpMain"
      @change="() => playerCountChanged('main')"
      :readonly="!canChangePlayersPerGrp"
    ></LabeledInput>
    <LabeledInput
      name="players"
      label="Entries Per Group (Remainder)"
      type="number"
      v-model="category.entriesPerGrpRemainder"
      @change="() => playerCountChanged('remainder')"
      :readonly="!canChangePlayersPerGrp"
    ></LabeledInput>
    <LabeledInput
      name="playerCount"
      label="Entries Count"
      type="number"
      readonly
      v-model="category.entries.length"
    >
    </LabeledInput>
    <div class="flex flex-row justify-between gap-4 pb-1 pt-4">
      <input
        type="file"
        name="inputfile"
        id="inputfile"
        data-test="input-entries"
        class="hidden"
        ref="file"
        accept=".xlsx"
        @change="onFileSelected"
      />
      <OutlinedButton
        data-test="do-draw"
        @click="emit('startDraw')"
        class="w-full"
        :disabled="category.entries.length === 0"
      >
        DO DRAW
      </OutlinedButton>
      <OutlinedButton
        data-test="import-entries"
        @click="file?.click()"
        class="w-full"
        :disabled="!isEntryTypeSelected"
      >
        IMPORT ENTRIES
      </OutlinedButton>
    </div>
    <div class="pt-1">
      <SimpleButton
        variant="text"
        data-test="download-template"
        class="w-full"
        @click="downloadEntryTemplate"
      >
        Download template
      </SimpleButton>
    </div>
    <div class="pb-1 pt-4">
      <SimpleButton
        variant="filled"
        data-test="matches"
        @click="router.push(`/tournament/matches/${category.shortName}`)"
        class="w-full"
        :disabled="!hasEntries || !hasShortName"
        :title="!hasShortName ? 'Enter a Short Form for this category first' : undefined"
      >
        Matches
      </SimpleButton>
    </div>
    <div v-if="isDebug">
      <div v-for="(grp, g) in category.groups" :key="'group-' + g" class="px-2 py-2">
        Group {{ g + 1 }}
        <div v-for="(round, r) in grp.rounds" :key="'round-' + g + '-' + r" class="px-2 py-1">
          Round {{ r + 1 }}
          <div v-for="(match, m) in round" :key="'match-' + g + '-' + r + '-' + m" class="px-2">
            M{{ m + 1 }}
            <p class="text-error">{{ match.datetime }} on {{ match.table }}</p>
            <p>
              {{ category.entries[match.entry1Idx] }} vs {{ category.entries[match.entry2Idx] }}
              {{ match.durationMinutes }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
