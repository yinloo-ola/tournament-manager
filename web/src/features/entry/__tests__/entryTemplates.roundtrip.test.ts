import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { readWorkbook } from '@/shared/excel/readWorkbook'
import { validateEntryWorkbook } from '@/features/entry/domain/readEntryWorkbook'
import { importSinglesEntries } from '@/features/entry/domain/importSingles'
import { importDoublesEntries } from '@/features/entry/domain/importDoubles'
import { importTeamEntries } from '@/features/entry/domain/importTeam'
import { EntryType } from '@/shared/model'

function assetBuffer(name: string): Uint8Array {
  return readFileSync(
    resolve(process.cwd(), 'src/features/entry/templates', name)
  )
}

function loadJson(path: string): unknown {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), path), 'utf-8')
  )
}

// The drift guard: each committed Entry Template asset must carry exactly the
// layout constants' sheets/headers, keep its import-invisible 'How to fill'
// sheet, and — with golden data rows injected after the template's own header
// — import to the golden entries. Hand-editing an asset without keeping the
// importers in mind fails here.
describe('Entry Template round-trip (drift guard)', () => {
  it('singles template validates and imports golden data', async () => {
    const workbook = await readWorkbook(assetBuffer('singles-entry-template.xlsx'))

    expect(workbook['How to fill']).toBeDefined()
    expect(() => validateEntryWorkbook(workbook, EntryType.Singles)).not.toThrow()

    const rows = loadJson(
      'src/features/entry/__tests__/golden/singles.rows.json'
    ) as { entries: string[][] }
    const filled = {
      ...workbook,
      entries: [workbook.entries![0], ...rows.entries.slice(1)]
    }
    const entries = importSinglesEntries(filled)

    expect(JSON.stringify(entries)).toBe(
      JSON.stringify(
        loadJson('src/features/entry/__tests__/golden/singles.golden.json')
      )
    )
  })

  it('doubles template validates and imports golden data', async () => {
    const workbook = await readWorkbook(assetBuffer('doubles-entry-template.xlsx'))

    expect(workbook['How to fill']).toBeDefined()
    expect(() => validateEntryWorkbook(workbook, EntryType.Doubles)).not.toThrow()

    const rows = loadJson(
      'src/features/entry/__tests__/golden/doubles.rows.json'
    ) as { entries: string[][]; players: string[][] }
    const filled = {
      ...workbook,
      players: [workbook.players![0], ...rows.players.slice(1)],
      entries: [workbook.entries![0], ...rows.entries.slice(1)]
    }
    const entries = importDoublesEntries(filled)

    expect(JSON.stringify(entries)).toBe(
      JSON.stringify(
        loadJson('src/features/entry/__tests__/golden/doubles.golden.json')
      )
    )
  })

  it('team template validates and imports golden data', async () => {
    const workbook = await readWorkbook(assetBuffer('team-entry-template.xlsx'))

    expect(workbook['How to fill']).toBeDefined()
    expect(() => validateEntryWorkbook(workbook, EntryType.Team)).not.toThrow()

    const rows = loadJson(
      'src/features/entry/__tests__/golden/team.rows.json'
    ) as { entries: string[][]; players: string[][] }
    const filled = {
      ...workbook,
      players: [workbook.players![0], ...rows.players.slice(1)],
      entries: [workbook.entries![0], ...rows.entries.slice(1)]
    }
    const entries = importTeamEntries(filled, 3, 3)

    expect(JSON.stringify(entries)).toBe(
      JSON.stringify(
        loadJson('src/features/entry/__tests__/golden/team.golden.json')
      )
    )
  })
})
