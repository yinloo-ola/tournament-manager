/**
 * Seed contract conformance guard (seed v1, ticket 03): the builder's output
 * must pass the consumer's REAL parser — the actual gate lineup-manager's
 * Import tournament runs — not a copy of its schema. The parser and its
 * supported version are imported live from the sibling checkout through the
 * test-only @lineup-manager alias, so a consumer-side contract change fails
 * HERE, as a red test in this repo, instead of at handover in the other app.
 *
 * The consumer is imported lazily inside each test: a static import would
 * fail module resolution at collection time, which reds the file with a
 * resolver error before the sibling-presence test below could deliver its
 * pointed message.
 */

import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildLineupSeed } from '../domain/buildLineupSeed'
import { buildFixture } from './fixture'
import type { SeedFile } from '@lineup-manager/domain/seed'

// The repos are permanent side-by-side siblings. If the checkout is missing,
// fail loudly — a green run that silently skipped the conformance check is
// worse than a red test.
const SIBLING_SEED = resolve(process.cwd(), '../../lineup-manager/src/domain/seed.ts')

/** Lazily load the consumer's parser (see the file docblock for why lazy). */
async function loadConsumer(): Promise<{
  parseSeed: (input: unknown) => SeedFile
  SUPPORTED_SEED_VERSION: number
}> {
  return import('@lineup-manager/domain/seed')
}

describe('seed contract conformance (lineup-manager parseSeed)', () => {
  it('requires the lineup-manager sibling checkout to be present', () => {
    expect(existsSync(SIBLING_SEED), {
      message:
        `Expected the lineup-manager sibling checkout at ${SIBLING_SEED} — the conformance ` +
        'guard runs its real seed parser. Clone lineup-manager next to this repo and re-run.'
    }).toBe(true)
  })

  it('parses the builder output cleanly', async () => {
    const { parseSeed } = await loadConsumer()
    const seed = buildLineupSeed(buildFixture())
    const parsed = parseSeed(JSON.parse(JSON.stringify(seed)))
    expect(parsed.tournamentName).toBe('Lineup Seed Test Cup')
    expect(parsed.teams).toHaveLength(3)
    expect(parsed.ties).toHaveLength(3)
  })

  it('emits the seed version the consumer supports', async () => {
    const { SUPPORTED_SEED_VERSION } = await loadConsumer()
    const seed = buildLineupSeed(buildFixture())
    expect(seed.seedVersion).toBe(SUPPORTED_SEED_VERSION)
  })

  it('bites: a team without a manager email is rejected by the consumer parser', async () => {
    const { parseSeed } = await loadConsumer()
    const seed = buildLineupSeed(buildFixture()) as unknown as Record<string, unknown[]>
    const teams = seed.teams as { managerEmail?: string }[]
    delete teams[0].managerEmail
    expect(() => parseSeed(seed)).toThrow(/managerEmail is missing/)
  })

  it('bites: a duplicate tie id is rejected by the consumer parser', async () => {
    const { parseSeed } = await loadConsumer()
    const seed = buildLineupSeed(buildFixture()) as unknown as Record<string, unknown[]>
    const ties = seed.ties as { id: string }[]
    ties[1].id = ties[0].id
    expect(() => parseSeed(seed)).toThrow(/Duplicate tie id/)
  })
})
