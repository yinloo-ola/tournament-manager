/**
 * Internal-hyperlink plumbing for workbooks written by ExcelJS 4.x.
 *
 * ExcelJS emits every hyperlink — including internal `Sheet!A1` links — with
 * an `r:id` relationship marked TargetMode="External" whose Target is the
 * link text itself. Excel follows that relationship in preference to the
 * `location` attribute, so clicking a schedule cell tries to open a file
 * named "matches!A2" and fails with "Cannot open the specified file".
 *
 * - `fixInternalHyperlinks` rewrites the zip after `writeBuffer`: any
 *   hyperlink that carries a `location` loses the bogus relationship,
 *   leaving the spec-correct internal form (`<hyperlink ref location/>`)
 *   that Excel navigates natively — the same XML excelize wrote.
 * - `readSheetHyperlinks` scrapes that form back out of the zip, because
 *   ExcelJS's reader silently drops location-only hyperlinks (it only maps
 *   hyperlinks that have an `r:id`).
 *
 * Both functions parse the machine-generated XML with regexes — the producer
 * is known (ExcelJS or Excel itself), so no general XML parser is needed.
 */

import JSZip from 'jszip'

// ---------------------------------------------------------------------------
// Small XML attribute helpers
// ---------------------------------------------------------------------------

const XML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'"
}

function decodeXmlEntities(s: string): string {
  return s.replace(/&(amp|lt|gt|quot|apos);/g, (_, entity: string) => XML_ENTITIES[entity])
}

/** Extract an attribute value from a single XML element string. */
function attrOf(element: string, name: string): string | undefined {
  const match = new RegExp(`\\s${name}="([^"]*)"`).exec(element)
  return match ? decodeXmlEntities(match[1]) : undefined
}

// ---------------------------------------------------------------------------
// Writer side — heal internal hyperlinks in a written workbook buffer
// ---------------------------------------------------------------------------

/**
 * Rewrite a workbook buffer so internal hyperlinks no longer carry the
 * bogus external relationship ExcelJS attaches to them.
 *
 * External hyperlinks (http(s) links, which have no `location` attribute)
 * are left untouched.
 */
export async function fixInternalHyperlinks(buffer: Uint8Array): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(buffer)
  const sheetPaths = Object.keys(zip.files).filter((p) => /^xl\/worksheets\/sheet\d+\.xml$/.test(p))
  let anyPatched = false

  for (const sheetPath of sheetPaths) {
    const sheetFile = zip.file(sheetPath)
    if (!sheetFile) continue
    const xml = await sheetFile.async('string')
    if (!xml.includes('<hyperlink')) continue

    const strippedRIds = new Set<string>()
    const patchedXml = xml.replace(/<hyperlink\b[^>]*\/>/g, (element) => {
      const rId = attrOf(element, 'r:id')
      if (!rId || !attrOf(element, 'location')) return element
      strippedRIds.add(rId)
      return element.replace(new RegExp(`\\sr:id="${rId}"`), '')
    })
    if (strippedRIds.size === 0) continue
    anyPatched = true
    zip.file(sheetPath, patchedXml)

    const relsPath = `xl/worksheets/_rels/${sheetPath.split('/').pop()}.rels`
    const relsFile = zip.file(relsPath)
    if (!relsFile) continue
    const relsXml = await relsFile.async('string')
    const patchedRels = relsXml.replace(/<Relationship\b[^>]*\/>/g, (relationship) =>
      strippedRIds.has(attrOf(relationship, 'Id') ?? '') ? '' : relationship
    )
    zip.file(relsPath, patchedRels)
  }

  if (!anyPatched) return buffer
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
}

// ---------------------------------------------------------------------------
// Reader side — scrape hyperlinks ExcelJS's reader drops
// ---------------------------------------------------------------------------

/** Resolve a sheet name to its `xl/worksheets/sheetN.xml` path. */
async function resolveSheetPath(
  zip: JSZip,
  sheetName: string
): Promise<string | undefined> {
  const workbookXml = await zip.file('xl/workbook.xml')?.async('string')
  if (!workbookXml) return undefined

  let sheetRId: string | undefined
  for (const match of workbookXml.matchAll(/<sheet\b[^>]*>/g)) {
    if (attrOf(match[0], 'name') === sheetName) {
      sheetRId = attrOf(match[0], 'r:id')
      break
    }
  }
  if (!sheetRId) return undefined

  const workbookRelsXml = await zip.file('xl/_rels/workbook.xml.rels')?.async('string')
  if (!workbookRelsXml) return undefined

  for (const match of workbookRelsXml.matchAll(/<Relationship\b[^>]*>/g)) {
    if (attrOf(match[0], 'Id') === sheetRId) {
      const target = attrOf(match[0], 'Target')
      if (!target) return undefined
      return target.startsWith('/') ? target.slice(1) : `xl/${target}`
    }
  }
  return undefined
}

/**
 * Read the hyperlinks of one sheet straight from the zip.
 *
 * Returns cell address ("B2") → target ("matches!A5"). Covers both the
 * internal `location` form and legacy relationship-based links (whose
 * target is resolved through the sheet's rels part).
 */
export async function readSheetHyperlinks(
  buffer: Uint8Array,
  sheetName: string
): Promise<Map<string, string>> {
  const links = new Map<string, string>()
  const zip = await JSZip.loadAsync(buffer)

  const sheetPath = await resolveSheetPath(zip, sheetName)
  if (!sheetPath) return links

  const sheetXml = await zip.file(sheetPath)?.async('string')
  if (!sheetXml) return links

  const relsPath = `xl/worksheets/_rels/${sheetPath.split('/').pop()}.rels`
  const relsXml = await zip.file(relsPath)?.async('string')
  const relTargets = new Map<string, string>()
  if (relsXml) {
    for (const match of relsXml.matchAll(/<Relationship\b[^>]*>/g)) {
      const id = attrOf(match[0], 'Id')
      const target = attrOf(match[0], 'Target')
      if (id && target) relTargets.set(id, target)
    }
  }

  for (const match of sheetXml.matchAll(/<hyperlink\b[^>]*>/g)) {
    const element = match[0]
    const ref = attrOf(element, 'ref')
    if (!ref) continue
    const location = attrOf(element, 'location')
    const rId = attrOf(element, 'r:id')
    const target = location ?? (rId ? relTargets.get(rId) : undefined)
    if (target) links.set(ref, target)
  }

  return links
}
