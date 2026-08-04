import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { EntryType, type Category } from '@/shared/model'
import CategoryCard from '@/features/tournament-config/ui/CategoryCard.vue'

// --- Module mocks ---------------------------------------------------------
// readWorkbook is the only async I/O seam in the import pipeline; mock it to
// return a small inline workbook and let the REAL importer run (per the
// lessons: thin I/O seams are mocked at the orchestration layer; the real
// ExcelJS path is covered by R1–R4 golden tests).
vi.mock('@/shared/excel/readWorkbook', () => ({
  readWorkbook: vi.fn()
}))
import { readWorkbook } from '@/shared/excel/readWorkbook'
const readWorkbookMock = vi.mocked(readWorkbook)

// Toast is mocked so error surfacing is observable without the host.
const toastErrorSpy = vi.fn()
vi.mock('@/shared/ui/toast', () => ({
  useToast: () => ({ toast: { error: toastErrorSpy, success: vi.fn(), info: vi.fn() } })
}))

// fetch is mocked to prove the local pipeline never calls the server.
const fetchSpy = vi.fn()

const singlesWorkbook: Record<string, string[][]> = {
  entries: [
    ['SN', 'Name', 'Club', 'Seeding', 'Date Of Birth', 'Gender'],
    ['1', 'Alice', 'ClubA', '5', '36892', 'F'],
    ['2', 'Bob', 'ClubB', '', '36893', 'M']
  ]
}

const doublesWorkbook: Record<string, string[][]> = {
  players: [
    ['SN', 'Name', 'Date Of Birth', 'Gender'],
    ['1', 'Alice', '36892', 'F'],
    ['2', 'Bob', '36893', 'M']
  ],
  entries: [
    ['SN', 'Player1', 'Player2', 'Club', 'Seeding'],
    ['1', 'Alice', 'Bob', 'ClubA', '3']
  ]
}

const teamWorkbook: Record<string, string[][]> = {
  players: [
    ['SN', 'Name', 'Date Of Birth', 'Gender', 'Team'],
    ['1', 'Alice', '36892', 'F', 'TeamA'],
    ['2', 'Bob', '36893', 'M', 'TeamA'],
    ['3', 'Carol', '36894', 'F', 'TeamA']
  ],
  entries: [
    ['SN', 'Team', 'Club', 'Seeding'],
    ['1', 'TeamA', 'ClubX', '5']
  ]
}

function baseCategory(overrides: Partial<Category> = {}): Category {
  return {
    name: 'Men Singles',
    shortName: 'MS',
    entryType: EntryType.Singles,
    entries: [],
    groups: [],
    knockoutRounds: [],
    entriesPerGrpMain: 4,
    entriesPerGrpRemainder: 3,
    durationMinutes: 30,
    numQualifiedPerGroup: 2,
    ...overrides
  }
}

function selectFile(wrapper: ReturnType<typeof mount>, fileName = 'fixture.xlsx') {
  // Simulate the <input type="file"> change event with a synthetic File.
  // jsdom forbids setting a non-empty value on file inputs, and vue-test-utils
  // wraps the event object (no custom target), so we attach files to the DOM
  // element directly, then trigger the native 'change' event.
  const input = wrapper.find('input[type="file"]')
  const file = new File(['dummy'], fileName, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  })
  Object.defineProperty(input.element, 'files', {
    value: [file],
    configurable: true
  })
  input.trigger('change')
}

beforeEach(() => {
  fetchSpy.mockClear()
  toastErrorSpy.mockClear()
  readWorkbookMock.mockReset()
  ;(globalThis as { fetch: unknown }).fetch = fetchSpy
  readWorkbookMock.mockResolvedValue(singlesWorkbook)
})

describe('CategoryCard entry import (R5)', () => {
  it('should import entries locally via readWorkbook + importer and emit players-imported', async () => {
    const wrapper = mount(CategoryCard, {
      props: { modelValue: baseCategory() }
    })

    selectFile(wrapper)
    await nextTick()
    await nextTick()

    expect(readWorkbookMock).toHaveBeenCalledTimes(1)
    // Real importer ran on the mocked workbook.
    const emitted = wrapper.emitted('playersImported')
    expect(emitted).toBeTruthy()
    expect(emitted![0][0]).toHaveLength(2)
    expect(emitted![0][0][0].entryType).toBe(EntryType.Singles)
    expect(emitted![0][0][0].singlesEntry.player.name).toBe('Alice')
    // No server call.
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('should import doubles locally and emit players-imported', async () => {
    readWorkbookMock.mockResolvedValue(doublesWorkbook)
    const wrapper = mount(CategoryCard, {
      props: { modelValue: baseCategory({ entryType: EntryType.Doubles }) }
    })

    selectFile(wrapper)
    await nextTick()
    await nextTick()

    const emitted = wrapper.emitted('playersImported')
    expect(emitted).toBeTruthy()
    expect(emitted![0][0][0].entryType).toBe(EntryType.Doubles)
    expect(emitted![0][0][0].doublesEntry.players[0].name).toBe('Alice')
    expect(emitted![0][0][0].doublesEntry.players[1].name).toBe('Bob')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('should import team locally and emit players-imported', async () => {
    readWorkbookMock.mockResolvedValue(teamWorkbook)
    const wrapper = mount(CategoryCard, {
      props: {
        modelValue: baseCategory({
          entryType: EntryType.Team,
          minPlayers: 3,
          maxPlayers: 3
        })
      }
    })

    selectFile(wrapper)
    await nextTick()
    await nextTick()

    const emitted = wrapper.emitted('playersImported')
    expect(emitted).toBeTruthy()
    expect(emitted![0][0][0].entryType).toBe(EntryType.Team)
    expect(emitted![0][0][0].teamEntry.teamName).toBe('TeamA')
    expect(emitted![0][0][0].teamEntry.players).toHaveLength(3)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('should surface an importer error via alert and not emit', async () => {
    readWorkbookMock.mockResolvedValue({}) // no 'entries' sheet → importer throws
    const wrapper = mount(CategoryCard, {
      props: { modelValue: baseCategory() }
    })

    selectFile(wrapper)
    await nextTick()
    await nextTick()

    expect(toastErrorSpy).toHaveBeenCalledWith('sheet entries does not exist')
    expect(wrapper.emitted('playersImported')).toBeUndefined()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('should run the team guards before importing', async () => {
    // min > max is an invalid combo that the setup defaulting (3/5) cannot
    // mask, so the guard must fire before any readWorkbook call.
    const wrapper = mount(CategoryCard, {
      props: {
        modelValue: baseCategory({
          entryType: EntryType.Team,
          minPlayers: 5,
          maxPlayers: 3
        })
      }
    })

    selectFile(wrapper)
    await nextTick()
    await nextTick()

    expect(toastErrorSpy).toHaveBeenCalledWith(
      'Minimum players must be less than maximum players'
    )
    expect(readWorkbookMock).not.toHaveBeenCalled()
    expect(wrapper.emitted('playersImported')).toBeUndefined()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('should reset the file input after import', async () => {
    const wrapper = mount(CategoryCard, {
      props: { modelValue: baseCategory() }
    })

    // jsdom forbids setting a non-empty value on file inputs, so we spy on
    // the underlying DOM setter to observe the reset (value = '').
    const input = wrapper.find('input[type="file"]')
    let setValue: string | null = null
    Object.defineProperty(input.element, 'value', {
      set(v: string) {
        setValue = v
      },
      get() {
        return setValue
      },
      configurable: true
    })

    selectFile(wrapper, 'fixture.xlsx')
    await nextTick()
    await nextTick()

    expect(setValue).toBe('')
  })
})
