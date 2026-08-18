export const BACKUP_INTERVAL_DAYS = 7

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1_000
export const BACKUP_INTERVAL_MILLISECONDS =
  BACKUP_INTERVAL_DAYS * DAY_IN_MILLISECONDS

export function isBackupDue(
  lastBackupAt: number | null,
  now: number = Date.now(),
): boolean {
  if (lastBackupAt === null) return true
  return now - lastBackupAt >= BACKUP_INTERVAL_MILLISECONDS
}

export function getNextBackupDueAt(lastBackupAt: number): number {
  return lastBackupAt + BACKUP_INTERVAL_MILLISECONDS
}
