import { describe, expect, it } from 'vitest'
import {
  daysUntil,
  formatDueLabel,
  getLocalDayBounds,
  getNextDueDate,
  rangeStartTimestamp,
  toLocalDateString,
} from './dates'

const today = new Date(2026, 7, 18, 14, 30)

describe('maintenance dates', () => {
  it('adds interval days to the last local completion date', () => {
    expect(getNextDueDate('2026-08-10', 14, today)).toBe('2026-08-24')
  })

  it('makes a never-completed task due today', () => {
    expect(getNextDueDate(null, 7, today)).toBe('2026-08-18')
    expect(formatDueLabel('2026-08-18', today)).toBe('Due today')
  })

  it('calculates future and overdue labels without time-of-day drift', () => {
    expect(daysUntil('2026-08-20', today)).toBe(2)
    expect(formatDueLabel('2026-08-20', today)).toBe('Due in 2 days')
    expect(formatDueLabel('2026-08-17', today)).toBe('1d overdue')
  })
})

describe('chart date range', () => {
  it('starts a seven-day window at local midnight six days earlier', () => {
    const start = new Date(rangeStartTimestamp(7, today))
    expect(toLocalDateString(start)).toBe('2026-08-12')
    expect(start.getHours()).toBe(0)
  })

  it('returns an inclusive local start and exclusive next-day boundary', () => {
    const bounds = getLocalDayBounds(today)
    const start = new Date(bounds.start)
    const end = new Date(bounds.end)

    expect(toLocalDateString(start)).toBe('2026-08-18')
    expect(start.getHours()).toBe(0)
    expect(toLocalDateString(end)).toBe('2026-08-19')
    expect(end.getHours()).toBe(0)
  })
})
