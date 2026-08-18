import { db, type ReservoirLog } from '../db/database'
import { getLocalDayBounds, toLocalDateString } from './dates'

export type ReservoirLogDraft = Omit<ReservoirLog, 'id' | 'timestamp'>

export async function saveDailyLog(
  form: ReservoirLogDraft,
  now: number = Date.now(),
): Promise<'created' | 'updated'> {
  const { start, end } = getLocalDayBounds(new Date(now))

  return db.transaction('rw', db.logs, async () => {
    const existing = await db.logs
      .where('timestamp')
      .between(start, end, true, false)
      .last()

    if (existing) {
      await db.logs.update(existing.id, { ...form, timestamp: now })
      return 'updated'
    }

    await db.logs.add({ ...form, timestamp: now })
    return 'created'
  })
}

export function latestLogPerLocalDay(logs: ReservoirLog[]): ReservoirLog[] {
  const latestByDay = new Map<string, ReservoirLog>()

  for (const log of logs) {
    const day = toLocalDateString(new Date(log.timestamp))
    const current = latestByDay.get(day)
    if (!current || log.timestamp > current.timestamp) {
      latestByDay.set(day, log)
    }
  }

  return [...latestByDay.values()].sort(
    (first, second) => first.timestamp - second.timestamp,
  )
}
