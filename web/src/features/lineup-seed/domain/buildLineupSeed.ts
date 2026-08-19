// Producer side of the lineup seed-file contract (the consumer lives in the
// lineup-manager repo). A pure export from a tournament-manager Tournament
// that emits seed contract v2: Team categories, team rosters with their
// manager emails, group-stage Team Matches with both teams, and the knockout
// stage as STRUCTURE plus SCHEDULED matches — the entry round as an unplaced
// pool (table + time; the lineup admin places them and enters teams) and
// later rounds as positional ties whose sides are fed by earlier slots. It
// does NOT emit rubbers/constraints/lead-time (authored in-product over
// there), and never emits teams for knockout ties (resolution lives in the
// lineup system — ADR 0004).
//
// tournament-manager carries no stable UUIDs (entries are array-indexed), so ids
// are derived deterministically from the data (category short name, team name,
// player name+dob, tie identity). They are stable across re-exports for
// unchanged data and unique within a seed. Pure: no UI, no network.

import { EntryType, MANAGER_EMAIL_SHAPE, type Match, type Tournament } from '@/shared/model'

/** The seed contract version this builder emits. The consumer's
 *  SUPPORTED_SEED_VERSION is the lockstep twin — during the v2 cutover see
 *  seedContract.test.ts for the transitional guard. */
export const SEED_VERSION = 2

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

/** Knockout round label by the round's slot size — bracket shorthand. Keyed
 *  off KnockoutRound.round (the size the model stores), not the match count. */
const KNOCKOUT_ROUND_LABELS: Record<number, string> = {
  256: 'R256',
  128: 'R128',
  64: 'R64',
  32: 'R32',
  16: 'R16',
  8: 'QF',
  4: 'SF',
  2: 'F'
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

/** Group-stage tie: both teams known at export. Id = teams + time (v1 form). */
export interface GroupSeedTie {
  id: string
  categoryId: string
  /** ISO date-time, tournament-local, of the scheduled start. */
  scheduledStart: string
  table?: string
  /** Human labels in this app's printed vocabulary ("Group 1", "Round 2"). */
  group: string
  round: string
  /** Exactly two team ids. */
  teamIds: [string, string]
}

/** Knockout entry-round tie — an UNPLACED pool match: table + time only, no
 *  bracket position (the lineup admin decides placement), no teams (resolution
 *  lives in the lineup system). Id = category|ko|label|table|time. */
export interface KnockoutPoolTie {
  id: string
  categoryId: string
  scheduledStart: string
  table: string
  round: string
}

/** Knockout later-round tie — positional, scheduled, both sides fed. */
export interface KnockoutFedTie {
  id: string
  categoryId: string
  scheduledStart: string
  table: string
  round: string
  /** The feeder slot ids for side 1 and side 2. */
  fedBy: [string, string]
}

export type SeedTie = GroupSeedTie | KnockoutPoolTie | KnockoutFedTie

/** One knockout category's bracket structure: every round's slot count plus,
 *  from the second round on, which earlier slots feed each side. Slot identity
 *  is the positional id scheme (category|ko|LABEL|n) — bye slots included. */
export interface SeedBracketRound {
  label: string
  slots: number
  fedBy?: [string, string][]
}

export interface SeedBracket {
  categoryId: string
  rounds: SeedBracketRound[]
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
  /** Knockout bracket structure per category — omitted when no category has
   *  a knockout stage. */
  brackets?: SeedBracket[]
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
  const brackets: SeedBracket[] = []

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

    // Scheduled group-stage Team Matches (both teams known from the draw).
    const collectGroupTie = (match: Match, group: string, round: string): void => {
      if (!match.datetime) return // unscheduled — no meaningful tie time
      const teamA = teamIdByEntryIdx.get(match.entry1Idx)
      const teamB = teamIdByEntryIdx.get(match.entry2Idx)
      if (!teamA || !teamB) return // bye / placeholder entry
      const scheduledStart = toTournamentLocal(match.datetime)
      const tie: GroupSeedTie = {
        id: `${teamA}|${teamB}|${scheduledStart}`,
        categoryId,
        scheduledStart,
        group,
        round,
        teamIds: [teamA, teamB]
      }
      if (match.table) tie.table = match.table
      ties.push(tie)
    }
    // Group stage — labels in the app's printed vocabulary, rounds numbered
    // per group (exactly what the category card and round-robin chart show).
    category.groups.forEach((group, g) => {
      group.rounds.forEach((round, r) => {
        for (const match of round) {
          collectGroupTie(match, `Group ${g + 1}`, `Round ${r + 1}`)
        }
      })
    })
    // Knockout — contract v2: structure + scheduled matches. The entry round
    // exports as an UNPLACED POOL (table + time, no position, no teams — the
    // lineup admin places them); later rounds export positionally with both
    // sides fed. Byes and unscheduled matches never enter ties[] but hold
    // their slots in brackets[]. An unexpected round size throws rather than
    // emitting a mislabelled seed.
    const slotIdsByRound: string[][] = []
    const bracketRounds: SeedBracketRound[] = []
    category.knockoutRounds.forEach((knockoutRound, r) => {
      const label = KNOCKOUT_ROUND_LABELS[knockoutRound.round]
      if (label === undefined) {
        throw new Error(
          `Cannot label a knockout round of size ${knockoutRound.round} — expected a power-of-two bracket size up to 256.`
        )
      }
      const slotIds = knockoutRound.matches.map((_, m) => `${categoryId}|ko|${label}|${m + 1}`)
      // Brackets halve by construction; a hand-edited document that breaks
      // that would silently emit undefined feed ids — fail loudly instead.
      if (r > 0 && slotIdsByRound[r - 1].length !== slotIds.length * 2) {
        throw new Error(
          `Knockout rounds do not halve: ${label} has ${slotIds.length} slots after ${slotIdsByRound[r - 1].length} — regenerate the bracket.`
        )
      }
      slotIdsByRound.push(slotIds)
      // Slot i of this round is fed by slots 2i (side 1) and 2i+1 (side 2) of
      // the previous round — the standard bracket wiring.
      const feederPair = (i: number): [string, string] => [
        slotIdsByRound[r - 1][2 * i],
        slotIdsByRound[r - 1][2 * i + 1]
      ]
      const bracketRound: SeedBracketRound = { label, slots: slotIds.length }
      if (r > 0) {
        bracketRound.fedBy = slotIds.map((_, s) => feederPair(s))
      }
      bracketRounds.push(bracketRound)

      knockoutRound.matches.forEach((match, m) => {
        if (match.bye || !match.datetime) return // bye / unscheduled — not exportable
        if (!match.table) {
          throw new Error(
            `Cannot export a scheduled knockout match without a table (${label} slot ${m + 1}) — fix the schedule first.`
          )
        }
        const scheduledStart = toTournamentLocal(match.datetime)
        if (r === 0) {
          ties.push({
            id: `${categoryId}|ko|${label}|${match.table}|${scheduledStart}`,
            categoryId,
            scheduledStart,
            round: label,
            table: match.table
          })
        } else {
          ties.push({
            id: slotIds[m],
            categoryId,
            scheduledStart,
            round: label,
            table: match.table,
            fedBy: feederPair(m)
          })
        }
      })
    })
    if (bracketRounds.length > 0) {
      brackets.push({ categoryId, rounds: bracketRounds })
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
  if (brackets.length > 0) {
    seed.brackets = brackets
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
