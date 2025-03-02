import type { Tournament } from '@/types/types'

export async function apiExportRoundRobinExcel(tournament: Tournament) {
  validTournament(tournament)

  return fetch('/api/exportRoundRobinExcel', {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    method: 'POST',
    body: JSON.stringify(tournament)
  }).then(function (res) {
    if (!res.ok) {
      return res.text().then((text) => {
        throw new Error(
          `Failed to export round robin excel: ${res.status} ${res.statusText}${text ? ' - ' + text : ''}`
        )
      })
    }
    return res.blob()
  })
}

export async function apiGenerateRounds(tournament: Tournament) {
  validTournament(tournament)
  return fetch('/api/generateRounds', {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    method: 'POST',
    body: JSON.stringify(tournament)
  }).then(function (res) {
    if (!res.ok) {
      return res.text().then((text) => {
        throw new Error(
          `Failed to generate rounds: ${res.status} ${res.statusText}${text ? ' - ' + text : ''}`
        )
      })
    }
    return res.json()
  })
}

export async function apiExportDraftSchedule(tournament: Tournament) {
  validTournament(tournament)
  return fetch('/api/exportDraftSchedule', {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    method: 'POST',
    body: JSON.stringify(tournament)
  }).then(function (res) {
    if (!res.ok) {
      return res.text().then((text) => {
        throw new Error(
          `Failed to export draft schedule: ${res.status} ${res.statusText}${text ? ' - ' + text : ''}`
        )
      })
    }
    return res.blob()
  })
}

export async function apiImportFinalSchedule(file: File) {
  const form = new FormData()
  form.append('file', file)
  return fetch('/api/importFinalSchedule', {
    headers: {
      Accept: 'application/json'
    },
    method: 'POST',
    body: form
  }).then(function (res) {
    if (!res.ok) {
      return res.text().then((text) => {
        throw new Error(
          `Failed to import final schedule: ${res.status} ${res.statusText}${text ? ' - ' + text : ''}`
        )
      })
    }
    return res.json()
  })
}

export async function apiExportScoresheetWithTemplate(tournament: Tournament, file: File) {
  validTournament(tournament)
  const form = new FormData()
  form.append('file', file)
  // Convert tournament object to JSON string and append it to the form
  form.append('tournament', JSON.stringify(tournament))

  return fetch('/api/exportScoresheetWithTemplate', {
    headers: {
      Accept: 'application/json'
    },
    method: 'POST',
    body: form
  }).then(function (res) {
    if (!res.ok) {
      return res.text().then((text) => {
        throw new Error(
          `Failed to export scoresheet with template: ${res.status} ${res.statusText}${text ? ' - ' + text : ''}`
        )
      })
    }
    return res.blob()
  })
}

function validTournament(tournament: Tournament) {
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
    if (category.durationMinutes == 0) {
      throw new Error('Duration must be specified')
    }
    if (category.numQualifiedPerGroup == 0) {
      throw new Error('Number of players qualified per group must be specified')
    }
    if (!tournament.numTables || tournament.numTables == 0) {
      throw new Error('Number of tables must be specified')
    }
  }
}
