const DAY_MS = 86_400_000

export function toLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export function getNextDueDate(
  lastCompletedDate: string | null,
  intervalDays: number,
  today: Date = new Date(),
): string {
  if (!lastCompletedDate) return toLocalDateString(today)
  return toLocalDateString(addDays(parseLocalDate(lastCompletedDate), intervalDays))
}

export function daysUntil(dateString: string, today: Date = new Date()): number {
  const target = parseLocalDate(dateString)
  const current = parseLocalDate(toLocalDateString(today))
  return Math.round((target.getTime() - current.getTime()) / DAY_MS)
}

export function formatDueLabel(
  dateString: string,
  today: Date = new Date(),
): string {
  const remaining = daysUntil(dateString, today)
  if (remaining < 0) return `${Math.abs(remaining)}d overdue`
  if (remaining === 0) return 'Due today'
  if (remaining === 1) return 'Due tomorrow'
  return `Due in ${remaining} days`
}

export function formatShortDate(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(timestamp)
}

export function rangeStartTimestamp(days: number, now: Date = new Date()): number {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - (days - 1))
  return start.getTime()
}

export function getLocalDayBounds(now: Date = new Date()): {
  start: number
  end: number
} {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = addDays(start, 1)
  return { start: start.getTime(), end: end.getTime() }
}
