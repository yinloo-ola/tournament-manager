import type { Group, KnockoutRound, Match, Tournament } from '@/types/types'

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
      alert(`No group data found for category ${category.name}`)
      return false
    }

    // Process knockout rounds
    if (categoriesKnockoutRoundsMap[category.shortName]) {
      const importedKnockoutRounds = categoriesKnockoutRoundsMap[category.shortName]

      // Clear existing knockout rounds and replace with imported ones
      category.knockoutRounds = []

      // Add each imported knockout round
      for (const importedRound of importedKnockoutRounds) {
        const knockoutRound: KnockoutRound = {
          round: importedRound.round,
          matches: []
        }

        // Add each match from the imported round
        for (const importedMatch of importedRound.matches) {
          const match: Match = {
            entry1Idx: importedMatch.entry1Idx,
            entry2Idx: importedMatch.entry2Idx,
            datetime: importedMatch.datetime,
            table: importedMatch.table,
            durationMinutes: category.durationMinutes
          }
          knockoutRound.matches.push(match)
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
