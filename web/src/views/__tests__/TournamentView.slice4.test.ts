import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * R4 wiring tests — verify TournamentView.vue is rewired to local pipeline
 * and client.ts dead code is removed. These are source-level assertions
 * (grep-gated) per the plan's acceptance criteria.
 */

const viewSource = readFileSync(
  resolve(__dirname, '../TournamentView.vue'),
  'utf-8'
)

const clientPath = resolve(__dirname, '../client/client.ts')
let clientSource: string | null = null
try {
  clientSource = readFileSync(clientPath, 'utf-8')
} catch {
  clientSource = null // file deleted — also valid
}

describe('TournamentView wiring (R4)', () => {
  describe('dead code removal', () => {
    it('should not import apiExportRoundRobinExcel or apiExportScoresheetWithTemplate', () => {
      expect(viewSource).not.toContain('apiExportRoundRobinExcel')
      expect(viewSource).not.toContain('apiExportScoresheetWithTemplate')
    })

    it('should not import from @/client/client', () => {
      expect(viewSource).not.toContain('client/client')
    })

    it('should not have the deleted functions in client.ts', () => {
      if (clientSource !== null) {
        expect(clientSource).not.toContain('apiExportRoundRobinExcel')
        expect(clientSource).not.toContain('apiExportScoresheetWithTemplate')
      }
    })
  })

  describe('local pipeline wiring', () => {
    it('should import createRobinCharts from roundrobinChartWorkbook', () => {
      expect(viewSource).toContain('createRobinCharts')
      expect(viewSource).toContain('roundrobinChartWorkbook')
    })

    it('should import exportScoresheets from scoresheetWorkbook', () => {
      expect(viewSource).toContain('exportScoresheets')
      expect(viewSource).toContain('scoresheetWorkbook')
    })

    it('should not call fetch in exportRoundRobin', () => {
      const start = viewSource.indexOf('function exportRoundRobin')
      const end = viewSource.indexOf('async function exportDraftSchedule')
      expect(start, 'exportRoundRobin marker must exist').toBeGreaterThan(-1)
      expect(end, 'exportDraftSchedule marker must exist').toBeGreaterThan(-1)
      const section = viewSource.substring(start, end)
      expect(section).not.toContain('fetch')
    })

    it('should not call fetch in scoresheet handler', () => {
      const start = viewSource.indexOf('exportScoresheetWithTemplateSelected')
      const end = viewSource.indexOf('const finalScheduleFile')
      expect(start, 'scoresheet handler marker must exist').toBeGreaterThan(-1)
      expect(end, 'finalScheduleFile marker must exist').toBeGreaterThan(-1)
      const section = viewSource.substring(start, end)
      expect(section).not.toContain('fetch')
    })
  })
})