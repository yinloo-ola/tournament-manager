// Canonical tournament model — the single source of truth for the application.
// Shape AND behavior live here. No other module may (de)serialize a tournament.

export const EntryByeIdx = -2
export const EntryEmptyIdx = -1

export type Player = {
  name: string
  dateOfBirth: string // yyyy-mm-dd
  gender: string // M or F
}

export interface SinglesEntry {
  player: Player
}

export interface DoublesEntry {
  players: [Player, Player]
}

export interface TeamEntry {
  teamName: string
  players: Player[]
  minPlayers: number
  maxPlayers: number
}

/** The manager-email shape the lineup system's seed parser enforces — the
 *  entry importer and the seed exporter check the same regex in lockstep. */
export const MANAGER_EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export enum EntryType {
  Unknown = 'Unknown',
  Singles = 'Singles',
  Doubles = 'Doubles',
  Team = 'Team'
}

// Entry is a class (not a plain type) because it carries behavior: the `name`
// getter and the `from()` rehydration factory. parse()/rehydrate() rebuild
// Entry instances wherever entries live in a document.
export class Entry {
  static from(json: any): Entry {
    return Object.assign(new Entry(json.entryType), json)
  }

  constructor(
    public entryType: EntryType,
    public seeding?: number,
    public club?: string,
    public managerEmail?: string,
    public singlesEntry?: SinglesEntry,
    public doublesEntry?: DoublesEntry,
    public teamEntry?: TeamEntry,
    public grpIdx?: number
  ) {
    switch (this.entryType) {
      case EntryType.Singles:
        this.singlesEntry = { player: { name: '', dateOfBirth: '', gender: '' } }
        break
      case EntryType.Doubles:
        this.doublesEntry = {
          players: [
            { name: '', dateOfBirth: '', gender: '' },
            { name: '', dateOfBirth: '', gender: '' }
          ]
        }
        break
      case EntryType.Team:
        this.teamEntry = {
          teamName: '',
          players: [{ name: '', dateOfBirth: '', gender: '' }],
          minPlayers: 0,
          maxPlayers: 0
        }
        break
    }
  }

  get name(): string {
    switch (this.entryType) {
      case EntryType.Singles:
        if (!this.singlesEntry) {
          return ''
        }
        return this.singlesEntry.player.name
      case EntryType.Doubles:
        if (!this.doublesEntry) {
          return ''
        }
        if (this.doublesEntry.players[0].name === '' && this.doublesEntry.players[1].name === '') {
          return ''
        }
        return `${this.doublesEntry.players[0].name} / ${this.doublesEntry.players[1].name}`
      case EntryType.Team:
        if (!this.teamEntry) {
          return ''
        }
        return this.teamEntry.teamName
      default:
        return ''
    }
  }
}

export type Match = {
  entry1Idx: number
  entry2Idx: number
  datetime: string
  durationMinutes: number
  table: string
  categoryShortName?: string
  groupIdx?: number
  roundIdx?: number
  round?: number
  matchIdx?: number
  /** Structural bye in a knockout entry round: the slot exists to hold the
   *  bracket's full shape (its lone qualifier advances) but is never
   *  scheduled — no table, no time — and never exported to the lineup seed. */
  bye?: boolean
}

export type Group = {
  entriesIdx: number[]
  rounds: Array<Array<Match>>
}

export type KnockoutRound = {
  round: number
  matches: Array<Match>
}

export type Category = {
  name: string
  entryType: EntryType
  shortName: string
  entriesPerGrpMain: number
  entriesPerGrpRemainder: number
  entries: Array<Entry>
  groups: Array<Group>
  knockoutRounds: Array<KnockoutRound>
  durationMinutes: number
  numQualifiedPerGroup: number
  minPlayers?: number
  maxPlayers?: number
}

export type Tournament = {
  name: string
  numTables: number
  startTime: string // Format: "2006-01-02T15:04"
  categories: Array<Category>
}

// Rehydrate a plain tournament object (e.g. from response.json() or JSON.parse)
// into the live model, rebuilding Entry instances. Entries live only in
// category.entries[]; groups and knockout rounds reference entries by index.
export function rehydrate(t: Tournament): Tournament {
  for (const cat of t.categories) {
    if (Array.isArray(cat.entries)) {
      cat.entries = cat.entries.map((e) => Entry.from(e))
    }
  }
  return t
}

export class ParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ParseError'
  }
}

// validateTournament guards the canonical shape a document must have to be
// ingested as a Tournament. It enforces the invariants the model relies on — an
// `entryType` on every category/entry, and `teamName` on team entries — so a
// structurally-drifted document (e.g. the legacy `teamEntry.name` instead of
// `teamName`, or a category missing `entryType`) fails loudly here instead of
// silently producing a broken in-memory model. Runs inside parse(), the single
// entry point for untrusted documents (open-from-file, autosave resume).
function validateTournament(t: any): void {
  if (!t || typeof t !== 'object' || !Array.isArray(t.categories)) {
    throw new ParseError('Invalid tournament document: missing categories.')
  }
  for (const category of t.categories) {
    if (!category || typeof category !== 'object') {
      throw new ParseError('Invalid tournament document: a category is invalid.')
    }
    if (!category.entryType || category.entryType === '') {
      throw new ParseError('Invalid tournament document: a category is missing entryType.')
    }
    if (!Array.isArray(category.entries)) {
      throw new ParseError('Invalid tournament document: a category is missing entries.')
    }
    for (const entry of category.entries) validateEntry(entry)
  }
}

function validateEntry(e: any): void {
  if (!e || typeof e !== 'object' || !e.entryType || e.entryType === '') {
    throw new ParseError('Invalid tournament document: an entry is missing entryType.')
  }
  if (e.entryType === EntryType.Team && (!e.teamEntry || !e.teamEntry.teamName)) {
    throw new ParseError('Invalid tournament document: a Team entry is missing teamName.')
  }
}

// Parse a tournament JSON string into the live model (Entry instances restored).
// Throws a typed ParseError on malformed JSON or structural violations — this is
// how open-from-file and autosave-resume reject untrusted/malformed documents.
export function parse(json: string): Tournament {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch (error) {
    throw new ParseError('Invalid tournament JSON: could not parse.')
  }
  const tournament = data as Tournament
  validateTournament(tournament)
  return rehydrate(tournament)
}

// Serialize the live model to a tournament JSON string.
export function serialize(t: Tournament): string {
  return JSON.stringify(t)
}
