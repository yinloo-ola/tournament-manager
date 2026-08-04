/**
 * Port of endpoint/schedule/internal/draft_schedule.go `scheduleMatches` +
 * `getSlotsForCategoryGroup` + `getSlotsForCategoryKnockout` +
 * `getOrCreateSlot` / `getOrCreateNextSlot`.
 *
 * Deterministic greedy time-slot allocation:
 * 1. Group stage: all categories in order; each category's group matches are
 *    assigned to tables via a round-robin `grpMatchTable`, then placed in the
 *    first available time-slot for that table.
 * 2. Knockout stage: all categories in order; matches placed sequentially on
 *    tables (round-robin), new slots created when full.
 *
 * `nextStartTime` advances per category by `durationMinutes` after the last
 * slot's start time.
 *
 * **UTC datetime parsing:** Go's `model.Date.UnmarshalJSON` uses
 * `time.Parse("2006-01-02T15:04", value)` which treats a layout without
 * timezone as UTC. But JS `new Date("2025-03-22T09:00")` (no Z) is local
 * time. This port parses startTime as UTC explicitly (appending 'Z').
 */

import type { Category, Tournament } from '@/shared/model'

// ---------------------------------------------------------------------------
// Types — mirror Go's model.Schedule / model.TimeSlot, using Date internally.
// ---------------------------------------------------------------------------

export interface ScheduledMatch {
  entry1Idx: number
  entry2Idx: number
  dateTime: Date
  durationMinutes: number
  table: string
  categoryShortName: string
  groupIdx: number
  roundIdx: number
  round: number
  matchIdx: number
}

export interface TimeSlot {
  tables: (ScheduledMatch | null)[]
}

export interface Schedule {
  startTime: Date
  timeSlots: TimeSlot[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse tournament.startTime ("2025-03-22T09:00") as UTC.
 *
 * Go's `time.Parse("2006-01-02T15:04", …)` treats no-timezone layouts as UTC.
 * JS `new Date("2025-03-22T09:00")` treats them as local. We append 'Z' to
 * force UTC, matching Go's behavior exactly.
 */
function parseStartTimeUTC(startTime: string): Date {
  return new Date(startTime + 'Z')
}

/** Add minutes to a Date, returning a new Date (immutable). */
function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000)
}

/** Port of model.TimeSlot.StartTimeAndDuration — earliest start + max duration. */
function startTimeAndDuration(slot: TimeSlot): { start: Date; duration: number } {
  let start = new Date(Date.UTC(3000, 0, 1, 0, 0, 0))
  let duration = 0
  for (const match of slot.tables) {
    if (match === null) continue
    if (match.dateTime.getTime() < start.getTime()) {
      start = match.dateTime
    }
    if (match.durationMinutes > duration) {
      duration = match.durationMinutes
    }
  }
  return { start, duration }
}

// ---------------------------------------------------------------------------
// Slot creation helpers
// ---------------------------------------------------------------------------

/**
 * Port of Go's `getOrCreateSlot` — searches ALL existing slots for the first
 * one where `table` is free; creates a new slot if none found.
 */
function getOrCreateSlot(
  slots: TimeSlot[],
  table: number,
  numOfTables: number
): { slots: TimeSlot[]; slotIdx: number } {
  if (slots.length === 0) {
    slots = [{ tables: new Array(numOfTables).fill(null) }]
    return { slots, slotIdx: 0 }
  }
  for (let s = 0; s < slots.length; s++) {
    if (slots[s].tables[table] === null) {
      return { slots, slotIdx: s }
    }
  }
  slots.push({ tables: new Array(numOfTables).fill(null) })
  return { slots, slotIdx: slots.length - 1 }
}

/**
 * Port of Go's `getOrCreateNextSlot` — only checks the LAST slot; creates a
 * new slot if the last one has `table` occupied.
 */
function getOrCreateNextSlot(
  slots: TimeSlot[],
  table: number,
  numOfTables: number
): { slots: TimeSlot[]; slotIdx: number } {
  if (slots.length === 0) {
    slots = [{ tables: new Array(numOfTables).fill(null) }]
    return { slots, slotIdx: 0 }
  }
  const lastIdx = slots.length - 1
  if (slots[lastIdx].tables[table] === null) {
    return { slots, slotIdx: lastIdx }
  }
  slots.push({ tables: new Array(numOfTables).fill(null) })
  return { slots, slotIdx: slots.length - 1 }
}

// ---------------------------------------------------------------------------
// Group-stage scheduling
// ---------------------------------------------------------------------------

/**
 * Port of Go's `getSlotsForCategoryGroup`.
 *
 * Pre-computes a `grpMatchTable` that assigns each match within each group
 * to a table (round-robin counter across `numOfTable`). Then iterates
 * groups → rounds → matches, placing each match in the first available slot
 * for its assigned table.
 */
function getSlotsForCategoryGroup(
  category: Category,
  numOfTable: number,
  startTime: Date
): TimeSlot[] {
  let slots: TimeSlot[] = []

  // Pre-compute table assignments for each (group, match-in-round-0) pair
  const grpMatchTable: Map<number, Map<number, number>> = new Map()
  let tableIdx = 0
  for (let g = 0; g < category.groups.length; g++) {
    const grp = category.groups[g]
    const numOfMatches = grp.rounds.length > 0 ? grp.rounds[0].length : 0
    grpMatchTable.set(g, new Map())
    for (let m = 0; m < numOfMatches; m++) {
      grpMatchTable.get(g)!.set(m, tableIdx)
      tableIdx++
      if (tableIdx === numOfTable) {
        tableIdx = 0
      }
    }
  }

  // Assign matches to slots
  for (let g = 0; g < category.groups.length; g++) {
    const grp = category.groups[g]
    for (let r = 0; r < grp.rounds.length; r++) {
      const round = grp.rounds[r]
      for (let m = 0; m < round.length; m++) {
        const match = round[m]
        const tIdx = grpMatchTable.get(g)!.get(m)!
        const result = getOrCreateSlot(slots, tIdx, numOfTable)
        slots = result.slots
        const slotIdx = result.slotIdx
        const matchStartTime = addMinutes(startTime, category.durationMinutes * slotIdx)
        slots[slotIdx].tables[tIdx] = {
          entry1Idx: match.entry1Idx,
          entry2Idx: match.entry2Idx,
          durationMinutes: category.durationMinutes,
          dateTime: matchStartTime,
          table: `T${tIdx + 1}`,
          categoryShortName: category.shortName,
          groupIdx: g,
          roundIdx: r,
          round: 0,
          matchIdx: 0
        }
      }
    }
  }

  return slots
}

// ---------------------------------------------------------------------------
// Knockout-stage scheduling
// ---------------------------------------------------------------------------

/**
 * Port of Go's `getSlotsForCategoryKnockout`.
 *
 * Iterates knockout rounds, placing matches sequentially on tables
 * (round-robin), creating new slots when the current one is full.
 */
function getSlotsForCategoryKnockout(
  category: Category,
  numOfTable: number,
  startTime: Date
): TimeSlot[] {
  let slots: TimeSlot[] = []

  for (const round of category.knockoutRounds) {
    let tableIdx = 0
    for (let m = 0; m < round.matches.length; m++) {
      const match = round.matches[m]
      const result = getOrCreateNextSlot(slots, tableIdx, numOfTable)
      slots = result.slots
      const slotIdx = result.slotIdx
      const matchStartTime = addMinutes(startTime, category.durationMinutes * slotIdx)
      slots[slotIdx].tables[tableIdx] = {
        entry1Idx: match.entry1Idx,
        entry2Idx: match.entry2Idx,
        dateTime: matchStartTime,
        durationMinutes: category.durationMinutes,
        table: `T${tableIdx + 1}`,
        categoryShortName: category.shortName,
        groupIdx: -1,
        roundIdx: 0,
        round: round.round,
        matchIdx: m
      }
      tableIdx++
      if (tableIdx === numOfTable) {
        tableIdx = 0
      }
    }
  }

  return slots
}

// ---------------------------------------------------------------------------
// Main scheduler
// ---------------------------------------------------------------------------

/**
 * Port of Go's `scheduleMatches(tournament model.Tournament) (model.Schedule, error)`.
 *
 * Schedules group stages first (all categories in order), then knockout stages
 * (all categories in order). Advances `nextStartTime` per category by
 * `durationMinutes` after the last slot's start time.
 */
export function scheduleMatches(tournament: Tournament): Schedule {
  if (tournament.numTables <= 0) {
    // numTables=0 is the newTournament() default; without this guard, slots get
    // empty `tables` arrays, matches land in sparse-array holes, and iterating
    // them throws "Cannot read properties of undefined (reading 'dateTime')".
    throw new Error('Number of Tables must be greater than 0 to generate a schedule.')
  }
  const zeroDurationCategory = tournament.categories.find(c => c.durationMinutes <= 0)
  if (zeroDurationCategory) {
    // durationMinutes=0 is the newTournament() default; without this guard, the
    // slot formula `addMinutes(startTime, durationMinutes * slotIdx)` collapses
    // every slot onto startTime, producing a schedule where all matches share a
    // single time instead of a clear, user-facing error.
    throw new Error(
      `Match Duration for "${zeroDurationCategory.name}" must be greater than 0 to generate a schedule.`
    )
  }
  const startDate = parseStartTimeUTC(tournament.startTime)
  const schedule: Schedule = {
    startTime: startDate,
    timeSlots: []
  }
  let nextStartTime = startDate

  // Schedule Group Stage
  for (let catIdx = 0; catIdx < tournament.categories.length; catIdx++) {
    const category = tournament.categories[catIdx]
    const slots = getSlotsForCategoryGroup(category, tournament.numTables, nextStartTime)
    if (slots.length === 0) {
      continue // Skip if no group matches
    }
    schedule.timeSlots.push(...slots)
    const { start: lastStart } = startTimeAndDuration(slots[slots.length - 1])
    nextStartTime = addMinutes(lastStart, category.durationMinutes)
  }

  // Schedule Knockout Stage
  for (let catIdx = 0; catIdx < tournament.categories.length; catIdx++) {
    const category = tournament.categories[catIdx]
    if (category.knockoutRounds.length === 0) {
      continue
    }
    const slots = getSlotsForCategoryKnockout(category, tournament.numTables, nextStartTime)
    if (slots.length === 0) {
      continue
    }
    schedule.timeSlots.push(...slots)
    const { start: lastStart } = startTimeAndDuration(slots[slots.length - 1])
    nextStartTime = addMinutes(lastStart, category.durationMinutes)
  }

  return schedule
}

// ---------------------------------------------------------------------------
// Utility: compute max table count across all time slots.
// Port of model.Schedule.MaxTableCount().
// ---------------------------------------------------------------------------

export function maxTableCount(schedule: Schedule): number {
  let tables = 0
  for (const slot of schedule.timeSlots) {
    if (slot.tables.length > tables) {
      tables = slot.tables.length
    }
  }
  return tables
}
