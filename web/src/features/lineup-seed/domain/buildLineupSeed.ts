// Producer side of the lineup seed-file contract (the consumer lives in the
// lineup-manager repo). A pure export from a tournament-manager Tournament
// that emits seed contract v1: Team categories, team rosters with their
// manager emails, and scheduled Team Matches labelled with their group-stage
// identity or knockout bracket position. It does NOT emit rubbers/
// constraints/lead-time (authored in-product over there).
//
// tournament-manager carries no stable UUIDs (entries are array-indexed), so ids
// are derived deterministically from the data (category short name, team name,
// player name+dob, tie teams+datetime). They are stable across re-exports for
// unchanged data and unique within a seed. Pure: no UI, no network.

import { EntryType, MANAGER_EMAIL_SHAPE, type Match, type Tournament } from '@/shared/model'

/** The seed contract version this builder emits — 1 while the lineup system's
 *  parser accepts 1 (their SUPPORTED_SEED_VERSION is the lockstep twin). */
export const SEED_VERSION = 1

/** The date-of-birth shapes the lineup system's parser accepts: an already-ISO
 *  yyyy-mm-dd date, or an Excel serial-day number (what readWorkbook yields for
 *  real date cells). Anything else fails its import. */
const DOB_SHAPE = /^\d{4}-\d{2}-\d{2}$|^\d+$/

/**
 * The seed contract's scheduledStart is tournament-local ISO date-time. The
 * schedule pipeline anchors UTC instants ("…T14:30:00.000Z") while the
 * organizer means local wall-clock — strip the designator (and seconds) so
 * consumer browsers render the time that was scheduled, not UTC + offset.
 * Offset-less strings pass through unchanged.
 */
function toTournamentLocal(datetime: string): string {
  return datetime.slice(0, 16)
}

/** Knockout round label by matches in the round — bracket shorthand. */
const KNOCKOUT_ROUND_LABELS: Record<number, string> = {
  64: 'R128',
  32: 'R64',
  16: 'R32',
  8: 'R16',
  4: 'QF',
  2: 'SF',
  1: 'F'
}

export interface SeedCategory {
  id: string
  name: string
  shortName: string
}

export interface SeedTeam {
  id: string
  name: string
  club?: string
  /** The team manager's login email in the lineup system — one per team. */
  managerEmail: string
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
  /** Human labels in this app's printed vocabulary ("Group 1", "Round 2");
   *  knockout Team Matches carry no group. */
  group?: string
  round?: string
  /** Exactly two team ids. */
  teamIds: [string, string]
}

export interface SeedFile {
  seedVersion: number
  tournamentName: string
  /** yyyy-mm-dd — the tournament's start date; omitted only when no start
   *  time exists (the import then derives it from the earliest tie). */
  startDate?: string
  categories: SeedCategory[]
  teams: SeedTeam[]
  players: SeedPlayer[]
  ties: SeedTie[]
}

/**
 * Build a lineup seed from a tournament: only Team categories, their teams +
 * rosters, and the scheduled team-vs-team Ties (round-robin + knockout matches
 * that have a datetime). Matches without a datetime (unscheduled) are omitted.
 *
 * Throws one aggregated refusal when any team lacks a valid, unique manager
 * email — naming every offender so a single export attempt reveals the full
 * fix list.
 */
export function buildLineupSeed(tournament: Tournament): SeedFile {
  const categories: SeedCategory[] = []
  const teams: SeedTeam[] = []
  const players: SeedPlayer[] = []
  const ties: SeedTie[] = []

  // Derived ids assume unique Team-category short names and unique team names
  // within a category. Fail loudly (the organizer gets the error in the UI)
  // rather than emitting a seed the consumer's parseSeed would reject.
  const seenShortNames = new Set<string>()
  for (const category of tournament.categories) {
    if (category.entryType !== EntryType.Team) continue
    if (seenShortNames.has(category.shortName)) {
      throw new Error(
        `Duplicate Team category short name "${category.shortName}" — lineup seed requires unique short names.`
      )
    }
    seenShortNames.add(category.shortName)
    const seenTeamNames = new Set<string>()
    for (const entry of category.entries) {
      const teamName = entry.teamEntry?.teamName ?? ''
      if (seenTeamNames.has(teamName)) {
        throw new Error(
          `Duplicate team name "${teamName}" in "${category.shortName}" — lineup seed requires unique team names per category.`
        )
      }
      seenTeamNames.add(teamName)
    }
  }

  // Manager emails: required on every team, email-shaped, unique across the
  // whole seed (one manager login per team — the lineup system's access model
  // keys on it). One aggregated message names everything to fix.
  assertTeamsExportable(tournament)

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
      const team: SeedTeam = {
        id: teamId,
        name: teamName,
        // Present and valid — assertManagerEmailsValid ran above.
        managerEmail: entry.managerEmail!
      }
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

    // Scheduled Team Matches: every round-robin + knockout match with a datetime.
    const collectTie = (match: Match, group?: string, round?: string): void => {
      if (!match.datetime) return // unscheduled — no meaningful tie time
      const teamA = teamIdByEntryIdx.get(match.entry1Idx)
      const teamB = teamIdByEntryIdx.get(match.entry2Idx)
      if (!teamA || !teamB) return // bye / placeholder entry
      const scheduledStart = toTournamentLocal(match.datetime)
      const tie: SeedTie = {
        id: `${teamA}|${teamB}|${scheduledStart}`,
        categoryId,
        scheduledStart,
        teamIds: [teamA, teamB]
      }
      if (group !== undefined) tie.group = group
      if (round !== undefined) tie.round = round
      if (match.table) tie.table = match.table
      ties.push(tie)
    }
    // Group stage — labels in the app's printed vocabulary, rounds numbered
    // per group (exactly what the category card and round-robin chart show).
    category.groups.forEach((group, g) => {
      group.rounds.forEach((round, r) => {
        for (const match of round) {
          collectTie(match, `Group ${g + 1}`, `Round ${r + 1}`)
        }
      })
    })
    // Knockout — no group; the bracket label derives from matches in the round.
    // An unexpected round size throws rather than emitting a mislabelled seed.
    for (const knockoutRound of category.knockoutRounds) {
      const label = KNOCKOUT_ROUND_LABELS[knockoutRound.matches.length]
      if (label === undefined) {
        throw new Error(
          `Cannot label a knockout round with ${knockoutRound.matches.length} matches — expected a power of two up to 64.`
        )
      }
      for (const match of knockoutRound.matches) collectTie(match, undefined, label)
    }
  }

  const seed: SeedFile = {
    seedVersion: SEED_VERSION,
    tournamentName: tournament.name,
    categories,
    teams,
    players,
    ties
  }
  if (tournament.startTime) {
    seed.startDate = tournament.startTime.slice(0, 10)
  }
  return seed
}

/** Aggregated export guard: every Team entry must carry an email-shaped,
 *  case-insensitively unique manager email, and every rostered player a
 *  date of birth the lineup system can parse (import normally enforces
 *  both — this catches hand-edited documents too). */
function assertTeamsExportable(tournament: Tournament): void {
  const problems: string[] = []
  const teamsByEmail = new Map<string, { email: string; teams: { name: string; shortName: string }[] }>()
  for (const category of tournament.categories) {
    if (category.entryType !== EntryType.Team) continue
    for (const entry of category.entries) {
      const teamName = entry.teamEntry?.teamName ?? ''
      const email = entry.managerEmail
      if (!email) {
        problems.push(`Team '${teamName}' (${category.shortName}) has no manager email.`)
        continue
      }
      if (!MANAGER_EMAIL_SHAPE.test(email)) {
        problems.push(
          `Team '${teamName}' (${category.shortName}) has an invalid Manager Email '${email}'.`
        )
        continue
      }
      const key = email.toLowerCase()
      const entry0 = teamsByEmail.get(key) ?? { email, teams: [] }
      entry0.teams.push({ name: teamName, shortName: category.shortName })
      teamsByEmail.set(key, entry0)
    }
  }
  for (const { email, teams: sharing } of teamsByEmail.values()) {
    if (sharing.length > 1) {
      // The message shows the email as first typed — the organizer's own
      // spelling — even when the clash is only in case.
      const listed = sharing.map((t) => `Team '${t.name}' (${t.shortName})`)
      const joined =
        listed.length === 2
          ? `${listed[0]} and ${listed[1]}`
          : `${listed.slice(0, -1).join(', ')} and ${listed[listed.length - 1]}`
      problems.push(`Manager Email '${email}' is shared by ${joined}.`)
    }
  }
  for (const category of tournament.categories) {
    if (category.entryType !== EntryType.Team) continue
    for (const entry of category.entries) {
      const teamName = entry.teamEntry?.teamName ?? ''
      for (const player of entry.teamEntry?.players ?? []) {
        if (player.dateOfBirth === '') {
          problems.push(
            `Player '${player.name}' (Team '${teamName}', ${category.shortName}) has no date of birth.`
          )
        } else if (!DOB_SHAPE.test(player.dateOfBirth)) {
          problems.push(
            `Player '${player.name}' (Team '${teamName}', ${category.shortName}) has an invalid date of birth '${player.dateOfBirth}'.`
          )
        }
      }
    }
  }
  if (problems.length > 0) {
    throw new Error(`Cannot export for the lineup system: ${problems.join(' ')}`)
  }
}
