import type { Group, KnockoutRound, Match, Tournament } from '@/types/types'

// Map a workbook-parsed knockout match back onto the model, stamping the
// category's current match duration.
function toModelMatch(importedMatch: Match, durationMinutes: number): Match {
  return {
    entry1Idx: importedMatch.entry1Idx,
    entry2Idx: importedMatch.entry2Idx,
    datetime: importedMatch.datetime,
    table: importedMatch.table,
    durationMinutes
  }
}

export function importFinalSchedule(
  categoriesGroupsMap: { [category: string]: Group[] },
  categoriesKnockoutRoundsMap: { [category: string]: KnockoutRound[] },
  tournament: Tournament
): boolean {
  for (let categoryIdx = 0; categoryIdx < tournament.categories.length; categoryIdx++) {
    const category = tournament.categories[categoryIdx]

    // Process group matches
    if (categoriesGroupsMap[category.shortName]) {
      const importedGroups = categoriesGroupsMap[category.shortName]

      // For each group in the category
      for (let i = 0; i < category.groups.length; i++) {
        // If there's a corresponding imported group
        if (i < importedGroups.length) {
          for (let j = 0; j < category.groups[i].rounds.length; j++) {
            if (j < importedGroups[i].rounds.length) {
              for (let k = 0; k < category.groups[i].rounds[j].length; k++) {
                if (k < importedGroups[i].rounds[j].length) {
                  category.groups[i].rounds[j][k].durationMinutes = category.durationMinutes
                  category.groups[i].rounds[j][k].datetime = importedGroups[i].rounds[j][k].datetime
                  category.groups[i].rounds[j][k].table = importedGroups[i].rounds[j][k].table
                }
              }
            }
          }
        }
      }
    } else {
      // Domain layer returns false; the caller surfaces the error to the UI.
      return false
    }

    // Process knockout rounds
    if (categoriesKnockoutRoundsMap[category.shortName]) {
      const importedKnockoutRounds = categoriesKnockoutRoundsMap[category.shortName]

      // The workbook holds only scheduled matches, so the imported map lacks
      // the bracket's structural byes (Match.bye — never scheduled). Capture
      // the existing rounds before clearing so byes can be re-attached.
      const existingByRound = new Map(category.knockoutRounds.map((r) => [r.round, r]))

      // Clear existing knockout rounds and replace with imported ones
      category.knockoutRounds = []

      // Add each imported knockout round
      for (const importedRound of importedKnockoutRounds) {
        const knockoutRound: KnockoutRound = {
          round: importedRound.round,
          matches: []
        }

        const existing = existingByRound.get(importedRound.round)
        const existingByeCount =
          existing?.matches.filter((m) => m.bye).length ?? 0
        // Re-attach only when the workbook rows line up with the existing
        // bracket's non-bye slots. This relies on imported matches arriving in
        // bracket order — guaranteed today by the matchIdx sort in the parser.
        const needsByeReattach =
          existing !== undefined &&
          existingByeCount > 0 &&
          existing.matches.length === importedRound.matches.length + existingByeCount

        if (needsByeReattach) {
          // Re-attach byes positionally; real slots take the imported matches
          // in order.
          let next = 0
          for (const existingMatch of existing.matches) {
            if (existingMatch.bye) {
              knockoutRound.matches.push(existingMatch)
              continue
            }
            knockoutRound.matches.push(
              toModelMatch(importedRound.matches[next++], category.durationMinutes)
            )
          }
        } else {
          // Shape mismatch (qualifier config changed between draft and final):
          // the import wins wholesale, as before.
          for (const importedMatch of importedRound.matches) {
            knockoutRound.matches.push(toModelMatch(importedMatch, category.durationMinutes))
          }
        }

        category.knockoutRounds.push(knockoutRound)
      }
    } else {
      // It's okay if there are no knockout rounds for a category
      category.knockoutRounds = []
    }
  }
  return true
}
