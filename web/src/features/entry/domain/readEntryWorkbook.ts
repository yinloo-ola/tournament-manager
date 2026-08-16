import { readWorkbook } from '@/shared/excel/readWorkbook'
import { EntryType } from '@/shared/model'
import { layoutFor } from './entryLayout'

/**
 * A structural import problem whose remedy is the Entry Template — missing
 * sheet, mismatched columns, or a file that isn't an Excel workbook. The
 * category card offers a "Download template" toast action for these.
 */
export class EntryTemplateError extends Error {}

/**
 * readEntryWorkbook is the entry-import read step: it parses the uploaded
 * file, then pre-validates its structure (expected sheets present, header
 * rows matching the layout constants) before any importer runs — so a
 * wrong-shaped file fails with the plain-language contract messages instead
 * of raw library errors or silently misread rows.
 *
 * Throws EntryTemplateError with the message contract:
 *  - "This file isn't a valid Excel (.xlsx) workbook." (unparseable file)
 *  - "Missing sheet 'entries' — see the Entry Template."
 *  - "Sheet 'entries' has unexpected columns — see the Entry Template."
 */
export async function readEntryWorkbook(
  source: File | ArrayBuffer | Uint8Array,
  entryType: EntryType
): Promise<Record<string, string[][]>> {
  let workbook: Record<string, string[][]>
  try {
    workbook = await readWorkbook(source)
  } catch {
    throw new EntryTemplateError(
      "This file isn't a valid Excel (.xlsx) workbook."
    )
  }
  validateEntryWorkbook(workbook, entryType)
  return workbook
}

/**
 * validateEntryWorkbook checks a pre-parsed workbook against the entry-type
 * layout: every expected sheet exists and its header row matches — labels
 * compared trimmed + case-insensitively, any label or count difference fails.
 * Header comparison runs before any data row is read, so a Doubles template
 * uploaded to a Team category is rejected here instead of having Player2
 * silently misread as Club.
 */
export function validateEntryWorkbook(
  workbook: Record<string, string[][]>,
  entryType: EntryType
): void {
  for (const { sheet, headers } of layoutFor(entryType)) {
    const rows = workbook[sheet]
    if (!rows) {
      throw new EntryTemplateError(
        `Missing sheet '${sheet}' — see the Entry Template.`
      )
    }
    const actual = (rows[0] ?? []).map(normalizeHeader)
    const expected = headers.map(normalizeHeader)
    if (
      actual.length !== expected.length ||
      actual.some((label, i) => label !== expected[i])
    ) {
      throw new EntryTemplateError(
        `Sheet '${sheet}' has unexpected columns — see the Entry Template.`
      )
    }
  }
}

const normalizeHeader = (label: string) => label.trim().toLowerCase()
