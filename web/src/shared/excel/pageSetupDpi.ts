/**
 * Print-DPI plumbing for workbooks written by ExcelJS 4.x.
 *
 * ExcelJS gives every worksheet a default `pageSetup` whose print resolution
 * is the sentinel 4294967295 (its "-1" default, serialized unsigned — see
 * `exceljs/lib/doc/worksheet.js`). Excel restricts horizontalDpi/verticalDpi
 * to plausible printer values (MS-OI29500 §18.3.1.63) and refuses the file
 * with a "we found a problem with some content" repair prompt.
 *
 * `fixInvalidPageSetupDpi` rewrites the zip after `writeBuffer`, dropping the
 * sentinel attributes so Excel applies its own default DPI. Explicitly
 * configured DPI values pass through untouched.
 *
 * Parses the machine-generated XML with regexes — the producer is known
 * (ExcelJS or Excel itself), so no general XML parser is needed.
 */

import JSZip from 'jszip'

/** ExcelJS's "no DPI set" default: -1 serialized as an unsigned 32-bit int. */
const SENTINEL_DPI = '4294967295'

/**
 * Rewrite a workbook buffer so no worksheet carries the sentinel print DPI.
 *
 * Workbooks without the sentinel (Excel-authored templates, already-fixed
 * buffers) are returned untouched.
 */
export async function fixInvalidPageSetupDpi(buffer: Uint8Array): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(buffer)
  const sheetPaths = Object.keys(zip.files).filter((p) =>
    /^xl\/worksheets\/sheet\d+\.xml$/.test(p)
  )
  let anyPatched = false

  for (const sheetPath of sheetPaths) {
    const sheetFile = zip.file(sheetPath)
    if (!sheetFile) continue
    const xml = await sheetFile.async('string')
    const patchedXml = xml.replace(
      new RegExp(`\\s(horizontalDpi|verticalDpi)="${SENTINEL_DPI}"`, 'g'),
      ''
    )
    if (patchedXml === xml) continue
    anyPatched = true
    zip.file(sheetPath, patchedXml)
  }

  if (!anyPatched) return buffer
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
}
