import type { Tournament } from '@/types/types'

export async function apiExportRoundRobinExcel(tournament: Tournament) {
  const nameMap: { [key: string]: boolean } = {}
  const shortFormMap: { [key: string]: boolean } = {}
  for (let i = 0; i < tournament.categories.length; i++) {
    const category = tournament.categories[i]
    if (category.shortName.length == 0) {
      throw new Error("'Category' and 'Short Form' must not be empty")
    }
    if (nameMap[category.name]) {
      throw new Error("Duplicated 'Category' detected")
    } else {
      nameMap[category.name] = true
    }
    if (shortFormMap[category.shortName]) {
      throw new Error("Duplicated 'Category' detected")
    } else {
      shortFormMap[category.shortName] = true
    }
  }

  return fetch('/api/exportRoundRobinExcel', {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    method: 'POST',
    body: JSON.stringify(tournament)
  }).then(function (res) {
    return res.blob()
  })
}