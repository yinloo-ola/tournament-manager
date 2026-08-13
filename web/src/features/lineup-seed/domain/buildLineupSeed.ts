// Producer side of the lineup seed-file contract (the consumer lives in the
// lineup-manager repo). A pure export from a tournament-manager Tournament that
// emits Team categories, team rosters, and scheduled team Ties — enough to seed
// the lineup system's structure. It does NOT emit rubbers/constraints/lead-time
// (authored in-product) or managers (provisioned separately).
//
// tournament-manager carries no stable UUIDs (entries are array-indexed), so ids
// are derived deterministically from the data (category short name, team name,
// player name+dob, tie teams+datetime). They are stable across re-exports for
// unchanged data and unique within a seed. Pure: no UI, no network.

import { EntryType, type Match, type Tournament } from '@/shared/model'

export interface SeedCategory {
  id: string
  name: string
  shortName: string
}

export interface SeedTeam {
  id: string
  name: string
  club?: string
}

export interface SeedPlayer {
  id: string
  teamId: string
  name: string
  gender: string
  dateOfBirth: string // yyyy-mm-dd
}

export interface SeedTie {
  id: string
  categoryId: string
  /** ISO date-time, tournament-local, of the scheduled start. */
  scheduledStart: string
  table?: string
  /** Exactly two team ids. */
  teamIds: [string, string]
}

export interface SeedFile {
  tournamentName: string
  categories: SeedCategory[]
  teams: SeedTeam[]
  players: SeedPlayer[]
  ties: SeedTie[]
}

/**
 * Build a lineup seed from a tournament: only Team categories, their teams +
 * rosters, and the scheduled team-vs-team Ties (round-robin + knockout matches
 * that have a datetime). Matches without a datetime (unscheduled) are omitted.
 */
export function buildLineupSeed(tournament: Tournament): SeedFile {
  const categories: SeedCategory[] = []
  const teams: SeedTeam[] = []
  const players: SeedPlayer[] = []
  const ties: SeedTie[] = []

  for (const category of tournament.categories) {
    if (category.entryType !== EntryType.Team) continue

    const categoryId = category.shortName
    categories.push({ id: categoryId, name: category.name, shortName: category.shortName })

    // Teams + rosters. teamId is scoped by category so the same club name in two
    // Team categories does not collide.
    const teamIdByEntryIdx = new Map<number, string>()
    category.entries.forEach((entry, idx) => {
      const teamName = entry.teamEntry?.teamName ?? ''
      const teamId = `${categoryId}|${teamName}`
      teamIdByEntryIdx.set(idx, teamId)
      const team: SeedTeam = { id: teamId, name: teamName }
      if (entry.club) team.club = entry.club
      teams.push(team)
      for (const player of entry.teamEntry?.players ?? []) {
        players.push({
          id: `${teamId}|${player.name}|${player.dateOfBirth}`,
          teamId,
          name: player.name,
          gender: player.gender,
          dateOfBirth: player.dateOfBirth
        })
      }
    })

    // Scheduled team Ties: every round-robin + knockout match with a datetime.
    const collectTie = (match: Match): void => {
      if (!match.datetime) return // unscheduled — no meaningful tie time
      const teamA = teamIdByEntryIdx.get(match.entry1Idx)
      const teamB = teamIdByEntryIdx.get(match.entry2Idx)
      if (!teamA || !teamB) return // bye / placeholder entry
      const tie: SeedTie = {
        id: `${teamA}|${teamB}|${match.datetime}`,
        categoryId,
        scheduledStart: match.datetime,
        teamIds: [teamA, teamB]
      }
      if (match.table) tie.table = match.table
      ties.push(tie)
    }
    for (const group of category.groups) {
      for (const round of group.rounds) {
        for (const match of round) collectTie(match)
      }
    }
    for (const knockoutRound of category.knockoutRounds) {
      for (const match of knockoutRound.matches) collectTie(match)
      }
  }

  return { tournamentName: tournament.name, categories, teams, players, ties }
}
