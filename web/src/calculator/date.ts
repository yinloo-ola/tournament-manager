export function getDateStringFromNow(daysFromNow: number, timeOfDay: number): string {
  const now = new Date()
  now.setDate(now.getDate() + daysFromNow)
  now.setHours(timeOfDay)
  return now.toISOString().slice(0, 16)
}
