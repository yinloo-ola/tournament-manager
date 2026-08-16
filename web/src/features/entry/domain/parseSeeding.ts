/**
 * parseSeeding mirrors Go's strconv.Atoi: optional sign + digits only.
 * Rejects whitespace, decimals, and non-numeric strings — matching Go's
 * behavior where Atoi("1.5") and Atoi(" 1 ") both error.
 *
 * Throws "failed to parse seeding" (the Go importer's inner message,
 * dropping the strconv.NumError detail per error-parity decisions).
 */
export function parseSeeding(s: string): number {
  if (!/^[+-]?\d+$/.test(s)) {
    throw new Error('failed to parse seeding')
  }
  return parseInt(s, 10)
}

/**
 * parseSeedingWithRow wraps parseSeeding with the plain-language message
 * contract importers surface: "Row N: Seeding 'X' isn't a whole number."
 */
export function parseSeedingWithRow(s: string, rowNum: number): number {
  try {
    return parseSeeding(s)
  } catch {
    throw new Error(`Row ${rowNum}: Seeding '${s.trim()}' isn't a whole number.`)
  }
}