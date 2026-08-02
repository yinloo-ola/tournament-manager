import { describe, it, expect } from 'vitest'
import { splitCellName } from '../address'

describe('splitCellName', () => {
  it('should split a single-letter cell address', () => {
    expect(splitCellName('A1')).toEqual({ col: 'A', row: 1 })
  })

  it('should split a single-letter cell with multi-digit row', () => {
    expect(splitCellName('Z26')).toEqual({ col: 'Z', row: 26 })
  })

  it('should split a two-letter column', () => {
    expect(splitCellName('AA1')).toEqual({ col: 'AA', row: 1 })
  })

  it('should split a multi-letter column', () => {
    expect(splitCellName('AC21')).toEqual({ col: 'AC', row: 21 })
  })

  it('should split ZZ99', () => {
    expect(splitCellName('ZZ99')).toEqual({ col: 'ZZ', row: 99 })
  })

  it('should split lowercase input (case-insensitive)', () => {
    expect(splitCellName('ac21')).toEqual({ col: 'AC', row: 21 })
  })

  it('should throw on empty string', () => {
    expect(() => splitCellName('')).toThrow()
  })

  it('should throw on digits-first (invalid)', () => {
    expect(() => splitCellName('123')).toThrow()
  })

  it('should throw on letters only (no row)', () => {
    expect(() => splitCellName('A')).toThrow()
  })

  it('should throw on invalid characters', () => {
    expect(() => splitCellName('A1B')).toThrow()
    expect(() => splitCellName('A!1')).toThrow()
  })

  it('should throw on letters after digits', () => {
    expect(() => splitCellName('A1B2')).toThrow()
  })
})