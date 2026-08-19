import ExcelJS from 'exceljs'
import type { Tournament, Match, Entry } from '@/shared/model'
import { cloneSheet } from '@/shared/excel/cloneSheet'

/**
 * exportScoresheets — port of Go's ExportScoresheet (excelize → ExcelJS).
 *
 * For every group match and every knockout match, clones the user-supplied
 * template sheet (named by the category's shortName) into a new sheet and
 * substitutes placeholders:
 *   {{category}} {{tournament}} {{date}} {{time}} {{table}} {{player1}} {{player2}}
 *
 * Modifies the template workbook in-place (adds new sheets), matching Go's
 * behavior which modifies the templateFile in-place.
 */
export function exportScoresheets(
  tournament: Tournament,
  templateWorkbook: ExcelJS.Workbook
): ExcelJS.Workbook {
  for (const category of tournament.categories) {
    // Group matches
    for (let grpIdx = 0; grpIdx < category.groups.length; grpIdx++) {
      const grp = category.groups[grpIdx]
      for (let rdIdx = 0; rdIdx < grp.rounds.length; rdIdx++) {
        for (const match of grp.rounds[rdIdx]) {
          addMatchScoresheet(
            tournament.name,
            category.entries,
            {
              ...match,
              categoryShortName: category.shortName,
              groupIdx: grpIdx,
              roundIdx: rdIdx,
              round: -1,
              matchIdx: -1,
            },
            templateWorkbook
          )
        }
      }
    }

    // Knockout matches (structural byes are never played — no scoresheet)
    for (const koRound of category.knockoutRounds) {
      for (let m = 0; m < koRound.matches.length; m++) {
        const match = koRound.matches[m]
        if (match.bye) {
          continue
        }
        addMatchScoresheet(
          tournament.name,
          category.entries,
          {
            ...match,
            categoryShortName: category.shortName,
            groupIdx: -1,
            roundIdx: -1,
            round: koRound.round,
            matchIdx: m,
          },
          templateWorkbook
        )
      }
    }
  }

  return templateWorkbook
}

/**
 * AddMatchScoresheet — port of Go's AddMatchScoresheet.
 *
 * 1. Find the template sheet (named by match.categoryShortName).
 * 2. Clone it into a new sheet with the match-specific name.
 * 3. Walk the clone's cells and substitute placeholders in-place.
 *
 * Only cells containing at least one placeholder token are modified;
 * all other cells retain their cloned values + styles.
 */
function addMatchScoresheet(
  tournamentName: string,
  entries: Entry[],
  match: Match,
  wb: ExcelJS.Workbook
): void {
  const templateName = match.categoryShortName!

  // Check if the template sheet exists
  const templateSheet = wb.getWorksheet(templateName)
  if (!templateSheet) {
    throw new Error(`template sheet '${templateName}' not found`)
  }

  // Generate sheet name
  const newSheetName = buildSheetName(match)

  // Skip if already exists (idempotent — matches Go's duplicate guard)
  if (wb.getWorksheet(newSheetName)) {
    return
  }

  // Clone the template sheet
  const newSheet = cloneSheet(templateSheet, wb, newSheetName)

  // Walk the clone's cells and substitute placeholders
  substitutePlaceholders(newSheet, tournamentName, entries, match)
}

/**
 * Build the new sheet name based on the match details.
 * Group: {cat}-Grp{grpIdx+1}-Rd{roundIdx+1}-{table}
 * Knockout: {cat}-KO-Rd{round}-{matchIdx+1}
 */
function buildSheetName(match: Match): string {
  const cat = match.categoryShortName!
  if (isKnockout(match)) {
    return `${cat}-KO-Rd${match.round}-${(match.matchIdx ?? 0) + 1}`
  }
  return `${cat}-Grp${(match.groupIdx ?? 0) + 1}-Rd${(match.roundIdx ?? 0) + 1}-${match.table}`
}

function isKnockout(match: Match): boolean {
  return (match.groupIdx ?? 0) < 0
}

/**
 * Walk the worksheet's cells and substitute placeholder tokens.
 * Only cells containing at least one `{{...}}` token are modified.
 */
function substitutePlaceholders(
  ws: ExcelJS.Worksheet,
  tournamentName: string,
  entries: Entry[],
  match: Match
): void {
  ws.eachRow({ includeEmpty: true }, (row) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      const raw = cell.value
      if (typeof raw !== 'string' || raw === '') return

      let value = raw
      let replaced = false

      if (value.includes('{{category}}')) {
        value = value.split('{{category}}').join(match.categoryShortName!)
        replaced = true
      }
      if (value.includes('{{tournament}}')) {
        value = value.split('{{tournament}}').join(tournamentName)
        replaced = true
      }
      if (value.includes('{{date}}')) {
        value = value.split('{{date}}').join(formatDate(match.datetime))
        replaced = true
      }
      if (value.includes('{{time}}')) {
        value = value.split('{{time}}').join(formatTime(match.datetime))
        replaced = true
      }
      if (value.includes('{{table}}')) {
        value = value.split('{{table}}').join(match.table)
        replaced = true
      }
      if (value.includes('{{player1}}')) {
        const name = match.entry1Idx >= 0 ? entries[match.entry1Idx]?.name ?? '' : ''
        value = value.split('{{player1}}').join(name)
        replaced = true
      }
      if (value.includes('{{player2}}')) {
        const name = match.entry2Idx >= 0 ? entries[match.entry2Idx]?.name ?? '' : ''
        value = value.split('{{player2}}').join(name)
        replaced = true
      }

      if (replaced) {
        cell.value = value
      }
    })
  })
}

/**
 * Format datetime string as YYYY-MM-DD (matching Go's Format("2006-01-02")).
 * Input: "2025-03-22T09:00" → "2025-03-22"
 */
function formatDate(datetime: string): string {
  return datetime.substring(0, 10)
}

/**
 * Format datetime string as HH:MM (matching Go's Format("15:04")).
 * Input: "2025-03-22T09:00" → "09:00"
 */
function formatTime(datetime: string): string {
  return datetime.substring(11, 16)
}