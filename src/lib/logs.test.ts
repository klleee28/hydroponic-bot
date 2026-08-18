import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/database'
import {
  createReservoirLog,
  deleteReservoirLog,
  updateReservoirLog,
} from './logs'

const draft = {
  ph: 6.1,
  ec: 1.4,
  water_temp: 21,
  water_added_liters: 0,
  notes: 'Morning',
}

describe('reservoir readings', () => {
  beforeEach(async () => {
    await db.logs.clear()
  })

  it('creates multiple readings on the same local day', async () => {
    const morning = new Date(2026, 7, 18, 8).getTime()
    const evening = new Date(2026, 7, 18, 19).getTime()

    await createReservoirLog(draft, morning, morning)
    await createReservoirLog({ ...draft, notes: 'Evening' }, evening, evening)

    expect(await db.logs.count()).toBe(2)
    expect((await db.logs.orderBy('timestamp').toArray()).map((log) => log.timestamp))
      .toEqual([morning, evening])
  })

  it('preserves measurement time while recording the edit time', async () => {
    const measuredAt = new Date(2026, 7, 18, 8).getTime()
    const editedAt = new Date(2026, 7, 18, 19).getTime()
    const id = await createReservoirLog(draft, measuredAt, measuredAt)

    await updateReservoirLog(id, { ...draft, ph: 6.3 }, measuredAt, editedAt)

    expect(await db.logs.get(id)).toMatchObject({
      timestamp: measuredAt,
      updated_at: editedAt,
      ph: 6.3,
    })
  })

  it('deletes only the selected reading', async () => {
    const first = await createReservoirLog(draft, 1, 1)
    await createReservoirLog(draft, 2, 2)

    await deleteReservoirLog(first)

    expect((await db.logs.toArray()).map((log) => log.timestamp)).toEqual([2])
  })
})
