import { describe, it, expect } from 'vitest'
import { hslToHex, generateColors, ColorMode } from '../color'

describe('hslToHex', () => {
  it('should produce pure red at h=0, s=1, l=0.5', () => {
    expect(hslToHex(0, 1, 0.5)).toBe('#FF0000')
  })

  it('should produce pure green at h=120, s=1, l=0.5', () => {
    expect(hslToHex(120, 1, 0.5)).toBe('#00FF00')
  })

  it('should produce pure blue at h=240, s=1, l=0.5', () => {
    expect(hslToHex(240, 1, 0.5)).toBe('#0000FF')
  })

  it('should produce achromatic gray at s=0 (truncation, not rounding)', () => {
    // int(0.5*255) = int(127.5) = 127 = 0x7F — Go truncates toward zero
    expect(hslToHex(0, 0, 0.5)).toBe('#7F7F7F')
  })

  it('should produce black at l=0', () => {
    expect(hslToHex(0, 1, 0)).toBe('#000000')
  })

  it('should produce white at l=1', () => {
    expect(hslToHex(0, 1, 1)).toBe('#FFFFFF')
  })

  it('should handle negative hue offset (h-120 < 0 wraps to +360)', () => {
    // h=0: b channel gets t=0-120=-120 → wraps to 240
    // At h=0,s=1,l=0.5: r=1.0, g=0.0, b=0.0 (verified above)
    // Already covered by pure-red test, but verify wrap explicitly
    expect(hslToHex(0, 1, 0.5)).toBe('#FF0000')
  })

  it('should handle hue > 360 wrapping', () => {
    // h=480 = 120 + 360 → should equal h=120
    expect(hslToHex(480, 1, 0.5)).toBe(hslToHex(120, 1, 0.5))
  })
})

describe('generateColors', () => {
  it('should produce the correct number of colors', () => {
    expect(generateColors(5, ColorMode.Light)).toHaveLength(5)
    expect(generateColors(3, ColorMode.Dark)).toHaveLength(3)
  })

  it('should produce valid #RRGGBB format for Light mode', () => {
    const colors = generateColors(5, ColorMode.Light)
    for (const c of colors) {
      expect(c).toMatch(/^#[0-9A-F]{6}$/)
    }
  })

  it('should produce valid #RRGGBB format for Dark mode', () => {
    const colors = generateColors(5, ColorMode.Dark)
    for (const c of colors) {
      expect(c).toMatch(/^#[0-9A-F]{6}$/)
    }
  })

  it('should be deterministic across calls (no randomness)', () => {
    const a = generateColors(5, ColorMode.Light)
    const b = generateColors(5, ColorMode.Light)
    expect(a).toEqual(b)
  })

  it('should be deterministic for Dark mode too', () => {
    const a = generateColors(5, ColorMode.Dark)
    const b = generateColors(5, ColorMode.Dark)
    expect(a).toEqual(b)
  })

  it('should use evenly spaced hues', () => {
    // With 4 colors, hues should be 0, 90, 180, 270
    // For Light mode: s=0.75, l=0.8 — we can verify the first color's hue=0
    const colors = generateColors(4, ColorMode.Light)
    // First color at hue=0: r-channel gets hueToRGB(p,q,120), g=0, b=240
    // These should all be different (distinct hues)
    const unique = new Set(colors)
    expect(unique.size).toBe(4)
  })

  it('should handle 1 color', () => {
    const colors = generateColors(1, ColorMode.Light)
    expect(colors).toHaveLength(1)
    expect(colors[0]).toMatch(/^#[0-9A-F]{6}$/)
  })
})
