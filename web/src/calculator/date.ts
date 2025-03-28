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
