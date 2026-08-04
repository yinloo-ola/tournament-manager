export function getDateStringFromNow(daysFromNow: number, timeOfDay: number): string {
  const now = new Date()
  now.setDate(now.getDate() + daysFromNow)
  now.setHours(timeOfDay)
  now.setMinutes(0)
  now.setSeconds(0)
  now.setMilliseconds(0)

  // Format in local timezone using the browser's locale
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')

  // Return in YYYY-MM-DDTHH:MM format (ISO-like but in local timezone)
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

// Format date from datetime string in GMT
export const formatDate = (datetime: string): string => {
  if (!datetime) return 'TBD'
  const date = new Date(datetime)
  // Convert to GMT date string format
  return date.toUTCString().split(' ').slice(0, 4).join(' ')
}

// Format time from datetime string in GMT
export const formatTime = (datetime: string): string => {
  if (!datetime) return 'TBD'
  const date = new Date(datetime)
  // Extract only the time portion in GMT without timezone indicator
  return date.toUTCString().split(' ')[4]
}

// Relative "edited Xh ago" for a past epoch-ms timestamp. Used by the recents
// list. Coarse by design — fine-grained relative time isn't worth a dependency.
export function relativeTimeFromNow(epochMs: number): string {
  const diff = Date.now() - epochMs
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return new Date(epochMs).toLocaleDateString()
}
