import { Entry, type Tournament } from '@/types/types'

export function exportTournamentJson(tournament: Tournament) {
  const filename = `tournament_${tournament.name}_${dateInYyyyMmDdHhMmSs(new Date(), '_')}.json`
  const blob = new Blob([JSON.stringify(tournament)], { type: 'text/json' })
  const link = document.createElement('a')

  link.download = filename
  link.href = window.URL.createObjectURL(blob)
  link.dataset.downloadurl = ['text/json', link.download, link.href].join(':')

  const evt = new MouseEvent('click', {
    view: window,
    bubbles: true,
    cancelable: true
  })

  link.dispatchEvent(evt)
  link.remove()
}

function padTwoDigits(num: number) {
  return num.toString().padStart(2, '0')
}

export function dateInYyyyMmDdHhMmSs(date: Date, dateDiveder: string = '-') {
  // :::: Exmple Usage ::::
  // The function takes a Date object as a parameter and formats the date as YYYY-MM-DD hh:mm:ss.
  // 👇️ 2023-04-11 16:21:23 (yyyy-mm-dd hh:mm:ss)
  //console.log(dateInYyyyMmDdHhMmSs(new Date()));

  //  👇️️ 2025-05-04 05:24:07 (yyyy-mm-dd hh:mm:ss)
  // console.log(dateInYyyyMmDdHhMmSs(new Date('May 04, 2025 05:24:07')));
  // Date divider
  // 👇️ 01/04/2023 10:20:07 (MM/DD/YYYY hh:mm:ss)
  // console.log(dateInYyyyMmDdHhMmSs(new Date(), "/"));
  return (
    [date.getFullYear(), padTwoDigits(date.getMonth() + 1), padTwoDigits(date.getDate())].join(
      dateDiveder
    ) +
    dateDiveder +
    [
      padTwoDigits(date.getHours()),
      padTwoDigits(date.getMinutes()),
      padTwoDigits(date.getSeconds())
    ].join(':')
  )
}

export function injectEntriesTournament(obj: Tournament) {
  // Convert plain entry objects to Entry class instances
  if (obj.categories && Array.isArray(obj.categories)) {
    obj.categories.forEach((category: any) => {
      if (category.entries && Array.isArray(category.entries)) {
        category.entries = category.entries.map((entry: any) => Entry.from(entry))
      }
      // Also convert entries within groups if they exist
      if (category.groups && Array.isArray(category.groups)) {
        category.groups.forEach((group: any) => {
          if (group.entries && Array.isArray(group.entries)) {
            group.entries = group.entries.map((entry: any) => Entry.from(entry))
          }
          if (group.rounds && Array.isArray(group.rounds)) {
            group.rounds.forEach((round: any) => {
              round.forEach((match: any) => {
                if (match.entry1) match.entry1 = Entry.from(match.entry1)
                if (match.entry2) match.entry2 = Entry.from(match.entry2)
                if (match.winner) match.winner = Entry.from(match.winner)
              })
            })
          }
        })
      }
      // Also convert entries within knockout rounds if they exist
      if (category.knockoutRounds && Array.isArray(category.knockoutRounds)) {
        category.knockoutRounds.forEach((round: any) => {
          if (round.matches && Array.isArray(round.matches)) {
            round.matches.forEach((match: any) => {
              if (match.entry1) match.entry1 = Entry.from(match.entry1)
              if (match.entry2) match.entry2 = Entry.from(match.entry2)
              if (match.winner) match.winner = Entry.from(match.winner)
            })
          }
        })
      }
    })
  }
}
