import { EntryType } from '@/shared/model'

/**
 * The Entry Template download: a static per-Entry-Type workbook (headers-only
 * fill-in sheets + an import-invisible "How to fill" sheet), committed under
 * features/entry/templates and pinned to the importers by the round-trip
 * drift test. The anchor's download attribute names the file after the
 * category so concurrent downloads don't collide.
 */

export function entryTemplateUrl(entryType: EntryType): string {
  switch (entryType) {
    case EntryType.Singles:
      return new URL('../templates/singles-entry-template.xlsx', import.meta.url).href
    case EntryType.Doubles:
      return new URL('../templates/doubles-entry-template.xlsx', import.meta.url).href
    case EntryType.Team:
      return new URL('../templates/team-entry-template.xlsx', import.meta.url).href
    case EntryType.Unknown:
      throw new Error('No Entry Template for this entry type')
  }
}

export function entryTemplateFilename(
  categoryName: string,
  entryType: EntryType
): string {
  const slug =
    slugify(categoryName) || entryType.toLowerCase()
  return `${slug}-entry-template.xlsx`
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
