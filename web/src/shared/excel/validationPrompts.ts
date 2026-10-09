/**
 * Data-validation prompt scraping for workbooks written by the interim
 * draft-schedule exporter, which hid each match's SN in a suppressed
 * validation prompt.
 *
 * Raw zip scraping is required — not just convenience: after referees move
 * cells, Excel saves overlapping validation entries (the moved cell's
 * prompted rule plus the destination's plain rule), and ExcelJS's parser
 * resolves overlaps last-wins, so a prompted entry earlier in the sheet
 * can be silently overwritten before any cell-level lookup happens. This
 * scraper walks the entries in document order and lets the first covering
 * prompt win, recovering identities ExcelJS's model has already lost.
 *
 * Parses the machine-generated XML with regexes — the producer is known
 * (ExcelJS or Excel itself), so no general XML parser is needed.
 */

import JSZip from 'jszip'
import { resolveSheetPath } from './internalHyperlinks'

/** Expand a sqref token ("B2" or "B2:I9") to individual cell addresses. */
function* expandSqrefPart(part: string): Generator<string> {
  if (!part.includes(':')) {
    yield part
    return
  }
  const decode = (addr: string) => {
    const m = /^([A-Z]+)(\d+)$/.exec(addr.toUpperCase())
    if (!m) return null
    let col = 0
    for (const ch of m[1]) col = col * 26 + ch.charCodeAt(0) - 64
    return { row: parseInt(m[2], 10), col }
  }
  const from = decode(part.split(':')[0])
  const to = decode(part.split(':')[1])
  if (!from || !to) return
  const columnName = (n: number) => {
    let s = ''
    while (n > 0) {
      const rem = (n - 1) % 26
      s = String.fromCharCode(65 + rem) + s
      n = Math.floor((n - 1) / 26)
    }
    return s
  }
  for (let row = Math.min(from.row, to.row); row <= Math.max(from.row, to.row); row++) {
    for (let col = Math.min(from.col, to.col); col <= Math.max(from.col, to.col); col++) {
      yield `${columnName(col)}${row}`
    }
  }
}

/**
 * Read the validation prompts of one sheet straight from the zip.
 *
 * Returns cell address ("B2") → prompt ("12"). When overlapping entries
 * cover the same cell, the first covering prompt wins — Excel's last-wins
 * consolidation would otherwise hide identities saved by moved cells.
 */
export async function readSheetValidationPrompts(
  buffer: Uint8Array,
  sheetName: string
): Promise<Map<string, string>> {
  const prompts = new Map<string, string>()
  const zip = await JSZip.loadAsync(buffer)

  const sheetPath = await resolveSheetPath(zip, sheetName)
  if (!sheetPath) return prompts

  const sheetXml = await zip.file(sheetPath)?.async('string')
  if (!sheetXml) return prompts

  for (const match of sheetXml.matchAll(/<dataValidation\b[^>]*>/g)) {
    const element = match[0]
    const prompt = element.match(/\sprompt="([^"]*)"/)?.[1]
    if (!prompt) continue
    const sqref = element.match(/\ssqref="([^"]*)"/)?.[1]
    if (!sqref) continue
    for (const part of sqref.split(/\s+/g)) {
      for (const addr of expandSqrefPart(part)) {
        if (!prompts.has(addr)) prompts.set(addr, prompt)
      }
    }
  }

  return prompts
}
