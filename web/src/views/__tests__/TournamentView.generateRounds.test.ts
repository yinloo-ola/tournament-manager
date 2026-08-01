import { describe, it, expect, beforeEach, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import CategoryCard from '@/features/tournament-config/ui/CategoryCard.vue'
import ModalDialog from '@/widgets/ModalDialog.vue'
import TournamentView from '@/views/TournamentView.vue'
import { Entry, EntryType, type Tournament, type Category } from '@/shared/model'
import { generateRoundsForTournament } from '@/features/matches/domain/generateRounds'

// --- Module mocks ---------------------------------------------------------
// Store is replaced with a real `ref` so Vue 3 template auto-unwrapping of
// `tournament.categories` keeps working; the placeholder avoids importing the
// real documentStore (and its side effects).
vi.mock('@/store/state', async () => {
  const { ref } = await import('vue')
  return { tournament: ref<Tournament | null>(null) }
})
vi.mock('@/features/tournament-doc/saveDocument', () => ({
  saveTournamentDocument: vi.fn()
}))
vi.mock('@/features/tournament-doc/storage/fileAccess', () => ({
  saveFileSink: vi.fn()
}))
vi.mock('@/calculator/tournament', () => ({
  dateInYyyyMmDdHhMmSs: () => 'stub',
  injectEntriesTournament: vi.fn()
}))
vi.mock('@/calculator/schedule', () => ({
  importFinalSchedule: vi.fn()
}))
// generateRoundsForTournament is spied, wrapping the REAL port so generation
// actually runs while calls are observable.
vi.mock('@/features/matches/domain/generateRounds', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/features/matches/domain/generateRounds')>()
  return {
    ...actual,
    generateRoundsForTournament: vi.fn(actual.generateRoundsForTournament)
  }
})

const generateSpy = vi.mocked(generateRoundsForTournament)
const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
const alertSpy = vi.fn().mockImplementation(() => {})

beforeEach(() => {
  fetchSpy.mockClear()
  alertSpy.mockClear()
  generateSpy.mockClear()
  ;(globalThis as { fetch: unknown }).fetch = fetchSpy
  ;(globalThis as { alert: unknown }).alert = alertSpy
})

function entry(name: string): Entry {
  const e = new Entry(EntryType.Singles)
  e.singlesEntry!.player.name = name
  return e
}

function makeSeed(opts: {
  groupSize: number
  numQualified: number
  entriesPerMain: number
  entriesPerRem: number
}): Tournament {
  const size = opts.groupSize
  const entries = Array.from({ length: size }, (_, i) => entry(`P${i + 1}`))
  const cat: Category = {
    name: 'Singles',
    shortName: 'main',
    entryType: EntryType.Singles,
    entriesPerGrpMain: opts.entriesPerMain,
    entriesPerGrpRemainder: opts.entriesPerRem,
    entries,
    groups: [{ entriesIdx: entries.map((_, i) => i), rounds: [] }],
    knockoutRounds: [],
    durationMinutes: 30,
    numQualifiedPerGroup: opts.numQualified
  }
  return { name: 'T', numTables: 2, startTime: '', categories: [cat] }
}

const tick = () => new Promise((r) => setTimeout(r, 0))

describe('TournamentView orchestration (R5)', () => {
  // R5 test #3 — closing the draw modal must run the LOCAL port and must NOT
  // hit POST /api/generateRounds.
  it('drawDone generates rounds via the local port, not the server fetch', async () => {
    const { tournament } = await import('@/store/state')
    tournament.value = makeSeed({
      groupSize: 4,
      numQualified: 2,
      entriesPerMain: 3,
      entriesPerRem: 4
    })

    const wrapper = shallowMount(TournamentView, {
      global: { stubs: ['RouterLink'] }
    })

    // CategoryCard "DO DRAW" -> drawCategory(0) -> opens the draw modal.
    await wrapper.findComponent(CategoryCard).vm.$emit('startDraw', 0)
    await tick()

    // ModalDialog close (backdrop/X) -> showDrawModal setter -> drawDone(groups).
    await wrapper.findComponent(ModalDialog).vm.$emit('update:modelValue', false)
    await tick()

    expect(generateSpy).toHaveBeenCalledTimes(1)
    expect(generateSpy).toHaveBeenCalledWith(tournament.value)
    // No server call to POST /api/generateRounds (and no fetch at all).
    expect(fetchSpy).not.toHaveBeenCalled()
    // The port populated the round-robin rounds on the bound document.
    expect(tournament.value.categories[0].groups[0].rounds.length).toBe(3)
  })

  // R5 test #4 — a generation failure is surfaced via alert and the document
  // is left unchanged (no partial mutation of the knockout bracket).
  it('drawDone surfaces a generation error via alert and leaves the document unchanged', async () => {
    const { tournament } = await import('@/store/state')
    tournament.value = makeSeed({
      groupSize: 1,
      numQualified: 2,
      entriesPerMain: 3,
      entriesPerRem: 4
    })

    const wrapper = shallowMount(TournamentView, {
      global: { stubs: ['RouterLink'] }
    })

    await wrapper.findComponent(CategoryCard).vm.$emit('startDraw', 0)
    await tick()
    await wrapper.findComponent(ModalDialog).vm.$emit('update:modelValue', false)
    await tick()

    expect(generateSpy).toHaveBeenCalledTimes(1)
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('not enough players'))
    // Knockout bracket untouched by the failed generation.
    expect(tournament.value.categories[0].knockoutRounds).toHaveLength(0)
  })
})
