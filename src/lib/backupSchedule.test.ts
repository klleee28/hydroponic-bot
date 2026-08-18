import { describe, expect, it } from 'vitest'
import {
  BACKUP_INTERVAL_MILLISECONDS,
  getNextBackupDueAt,
  isBackupDue,
} from './backupSchedule'

describe('weekly backup schedule', () => {
  const now = new Date('2026-08-18T08:00:00.000Z').getTime()

  it('is due when no full backup has been saved', () => {
    expect(isBackupDue(null, now)).toBe(true)
  })

  it('becomes due at exactly seven elapsed days', () => {
    const lastBackupAt = now - BACKUP_INTERVAL_MILLISECONDS

    expect(isBackupDue(lastBackupAt, now - 1)).toBe(false)
    expect(isBackupDue(lastBackupAt, now)).toBe(true)
  })

  it('does not treat a future device timestamp as due', () => {
    expect(isBackupDue(now + 60_000, now)).toBe(false)
  })

  it('calculates the next due timestamp deterministically', () => {
    expect(getNextBackupDueAt(now)).toBe(now + BACKUP_INTERVAL_MILLISECONDS)
  })
})
