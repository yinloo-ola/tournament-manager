import type { Group, Tournament } from '@/types/types'

export function importFinalSchedule(
  categoriesGroupsMap: { [category: string]: Group[] },
  tournament: Tournament
): boolean {
  for (let categoryIdx = 0; categoryIdx < tournament.categories.length; categoryIdx++) {
    const category = tournament.categories[categoryIdx]
    // Check if this category exists in the imported data
    if (categoriesGroupsMap[category.shortName]) {
      const importedGroups = categoriesGroupsMap[category.shortName]

      // For each group in the category
      for (let i = 0; i < category.groups.length; i++) {
        // If there's a corresponding imported group
        for (let j = 0; j < category.groups[i].rounds.length; j++) {
          for (let k = 0; k < category.groups[i].rounds[j].length; k++) {
            category.groups[i].rounds[j][k].durationMinutes = category.durationMinutes
            category.groups[i].rounds[j][k].datetime = importedGroups[i].rounds[j][k].datetime
            category.groups[i].rounds[j][k].table = importedGroups[i].rounds[j][k].table
          }
        }
      }
    } else {
      alert(`No data found for category ${category.name}`)
      return false
    }
  }
  return true
}
