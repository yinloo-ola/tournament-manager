import { describe, it, expect } from 'vitest'
import { EntryType } from '@/shared/model'
import {
  readEntryWorkbook,
  validateEntryWorkbook,
  EntryTemplateError
} from '../readEntryWorkbook'

const singlesWorkbook: Record<string, string[][]> = {
  entries: [
    ['SN', 'Name', 'Club', 'Seeding', 'Date Of Birth', 'Gender'],
    ['1', 'Alice', 'ClubA', '5', '36892', 'F']
  ]
}

const doublesWorkbook: Record<string, string[][]> = {
  players: [
    ['SN', 'Name', 'Date Of Birth', 'Gender'],
    ['1', 'Alice', '36892', 'F']
  ],
  entries: [
    ['SN', 'Player1', 'Player2', 'Club', 'Seeding'],
    ['1', 'Alice', 'Bob', 'ClubA', '3']
  ]
}

const teamWorkbook: Record<string, string[][]> = {
  players: [
    ['SN', 'Name', 'Date Of Birth', 'Gender', 'Team'],
    ['1', 'Alice', '36892', 'F', 'TeamA']
  ],
  entries: [
    ['SN', 'Team', 'Club', 'Seeding'],
    ['1', 'TeamA', 'ClubX', '5']
  ]
}

describe('validateEntryWorkbook', () => {
  it('should accept a workbook matching each entry type layout', () => {
    expect(() =>
      validateEntryWorkbook(singlesWorkbook, EntryType.Singles)
    ).not.toThrow()
    expect(() =>
      validateEntryWorkbook(doublesWorkbook, EntryType.Doubles)
    ).not.toThrow()
    expect(() => validateEntryWorkbook(teamWorkbook, EntryType.Team)).not.toThrow()
  })

  it('should throw the contract message naming a missing sheet', () => {
    expect(() => validateEntryWorkbook({}, EntryType.Singles)).toThrow(
      "Missing sheet 'entries' — see the Entry Template."
    )
    expect(() =>
      validateEntryWorkbook({ entries: teamWorkbook.entries }, EntryType.Team)
    ).toThrow("Missing sheet 'players' — see the Entry Template.")
  })

  it('should throw the contract message for mismatched columns', () => {
    const wrongLabels = {
      entries: [
        ['SN', 'Player1', 'Player2', 'Club', 'Seeding'],
        ['1', 'Alice', 'Bob', 'ClubA', '3']
      ]
    }
    expect(() =>
      validateEntryWorkbook(wrongLabels, EntryType.Singles)
    ).toThrow("Sheet 'entries' has unexpected columns — see the Entry Template.")
  })

  it('should reject a column-count difference as a mismatch', () => {
    const extraColumn = {
      entries: [
        [...singlesWorkbook.entries[0], 'Notes'],
        ['1', 'Alice', 'ClubA', '5', '36892', 'F', 'hi']
      ]
    }
    expect(() =>
      validateEntryWorkbook(extraColumn, EntryType.Singles)
    ).toThrow("Sheet 'entries' has unexpected columns — see the Entry Template.")
  })

  it('should compare headers trimmed and case-insensitively', () => {
    const sloppy = {
      entries: [
        [' sn ', 'name', 'CLUB', 'Seeding', 'date of birth', 'Gender'],
        ['1', 'Alice', 'ClubA', '5', '36892', 'F']
      ]
    }
    expect(() =>
      validateEntryWorkbook(sloppy, EntryType.Singles)
    ).not.toThrow()
  })

  it('should throw EntryTemplateError so callers can offer the template action', () => {
    try {
      validateEntryWorkbook({}, EntryType.Singles)
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(EntryTemplateError)
      expect(error).toBeInstanceOf(Error)
    }
  })
})

describe('readEntryWorkbook', () => {
  it('should wrap parse failures as the friendly not-a-workbook message', async () => {
    const garbage = new Uint8Array([
      116, 104, 105, 115, 32, 105, 115, 32, 110, 111, 116, 32, 97, 32, 122
    ])
    await expect(
      readEntryWorkbook(garbage, EntryType.Singles)
    ).rejects.toThrow("This file isn't a valid Excel (.xlsx) workbook.")
  })

  it('should reject a garbage file with EntryTemplateError', async () => {
    const garbage = new Uint8Array([1, 2, 3])
    await expect(
      readEntryWorkbook(garbage, EntryType.Singles)
    ).rejects.toBeInstanceOf(EntryTemplateError)
  })
})
