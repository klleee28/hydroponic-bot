import { db, type ReservoirLog } from '../db/database'

export type ReservoirLogDraft = Omit<
  ReservoirLog,
  'id' | 'timestamp' | 'updated_at'
>

export async function createReservoirLog(
  form: ReservoirLogDraft,
  timestamp: number = Date.now(),
  updatedAt: number = Date.now(),
): Promise<number> {
  return db.logs.add({ ...form, timestamp, updated_at: updatedAt })
}

export async function updateReservoirLog(
  id: number,
  form: ReservoirLogDraft,
  timestamp: number,
  updatedAt: number = Date.now(),
): Promise<void> {
  await db.logs.update(id, { ...form, timestamp, updated_at: updatedAt })
}

export async function deleteReservoirLog(id: number): Promise<void> {
  await db.logs.delete(id)
}
