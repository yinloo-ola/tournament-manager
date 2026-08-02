/**
 * Port of utils/color/color.go — HSL to #RRGGBB hex conversion.
 *
 * **Deliberate behavior change:** Go's `GenerateColors` seeds `rand` with
 * `time.Now()` and adds ±10° random hue jitter, making colors non-deterministic
 * run-to-run. This TS port is **deterministic** — hues are evenly spaced with
 * fixed S/L per mode. Colors are decorative; the design doc explicitly approves
 * this change. See docs/plans/2026-08-01-pure-frontend-slice3-schedule-design.md
 * "Production-risk areas."
 *
 * The `hslToHex` algorithm is a faithful port of Go's `hslToRGB` + `hueToRGB`,
 * including `int(r*255)` truncation (Go truncates toward zero; JS `Math.floor`
 * matches for positive values — NOT `Math.round`).
 */

export enum ColorMode {
  Dark = 0,
  Light = 1,
}

/**
 * Convert HSL to #RRGGBB hex.
 *
 * Hue is in degrees (0–360), matching Go's convention (not 0–1).
 * Saturation and lightness are 0–1.
 *
 * Port of Go's `hslToRGB(h, s, l float64) string`.
 */
export function hslToHex(h: number, s: number, l: number): string {
  let r: number, g: number, b: number

  if (s === 0) {
    r = g = b = l // Achromatic (gray)
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hueToRGB(p, q, h + 120)
    g = hueToRGB(p, q, h)
    b = hueToRGB(p, q, h - 120)
  }

  return (
    '#' +
    toHexByte(r) +
    toHexByte(g) +
    toHexByte(b)
  )
}

/** Go's int(r*255) truncates toward zero; Math.floor matches for positive values. */
function toHexByte(v: number): string {
  return Math.floor(v * 255)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase()
}

/**
 * Port of Go's `hueToRGB(p, q, t float64) float64`.
 * `t` is in degrees (0–360 range, with wrap-around).
 */
function hueToRGB(p: number, q: number, t: number): number {
  if (t < 0) t += 360
  if (t > 360) t -= 360
  if (t < 60) return p + ((q - p) * t) / 60
  if (t < 180) return q
  if (t < 240) return p + ((q - p) * (240 - t)) / 60
  return p
}

/**
 * Generate `numColors` distinctly different colors.
 *
 * **Deterministic** (unlike Go's random version): evenly spaced hues, fixed
 * S/L per mode. The saturation and lightness values are the midpoints of
 * Go's random ranges:
 * - Light: S=0.75 (midpoint of 0.5–1.0), L=0.8 (midpoint of 0.7–0.9)
 * - Dark:  S=0.75 (midpoint of 0.5–1.0), L=0.35 (midpoint of 0.2–0.5)
 *
 * Port of Go's `GenerateColors(numColors int, mode ColorMode) []string`.
 */
export function generateColors(numColors: number, mode: ColorMode): string[] {
  const colors: string[] = []
  let saturation: number, lightness: number

  switch (mode) {
    case ColorMode.Dark:
      saturation = 0.75 // midpoint of 0.5–1.0
      lightness = 0.35 // midpoint of 0.2–0.5
      break
    case ColorMode.Light:
      saturation = 0.75 // midpoint of 0.5–1.0
      lightness = 0.8 // midpoint of 0.7–0.9
      break
  }

  const hueStep = 360.0 / numColors
  for (let i = 0; i < numColors; i++) {
    // No random jitter — deterministic. Go used math.Mod(i*hueStep + rand*10, 360)
    const hue = i * hueStep
    colors.push(hslToHex(hue, saturation, lightness))
  }

  return colors
}