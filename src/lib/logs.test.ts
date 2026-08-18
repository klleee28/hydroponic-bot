import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, type ReservoirLog } from '../db/database'
import { latestLogPerLocalDay, saveDailyLog } from './logs'

function makeLog(id: number, timestamp: number): ReservoirLog {
  return {
    id,
    timestamp,
    ph: 6 + id / 10,
    ec: 1.2,
    water_temp: 21,
    water_added_liters: 0,
    notes: '',
  }
}

describe('latestLogPerLocalDay', () => {
  it('keeps the newest reading from each local calendar day', () => {
    const morning = new Date(2026, 7, 18, 8).getTime()
    const evening = new Date(2026, 7, 18, 19).getTime()
    const nextDay = new Date(2026, 7, 19, 7).getTime()

    expect(
      latestLogPerLocalDay([
        makeLog(3, nextDay),
        makeLog(2, evening),
        makeLog(1, morning),
      ]).map((log) => log.id),
    ).toEqual([2, 3])
  })

  it('does not mutate the source log order', () => {
    const logs = [
      makeLog(2, new Date(2026, 7, 19, 8).getTime()),
      makeLog(1, new Date(2026, 7, 18, 8).getTime()),
    ]

    latestLogPerLocalDay(logs)
    expect(logs.map((log) => log.id)).toEqual([2, 1])
  })
})

describe('saveDailyLog', () => {
  beforeEach(async () => {
    await db.logs.clear()
  })

  it('creates the first reading of a day and updates it on later saves', async () => {
    const draft = {
      ph: 6.1,
      ec: 1.4,
      water_temp: 21,
      water_added_liters: 0,
      notes: 'Morning',
    }
    const morning = new Date(2026, 7, 18, 8).getTime()
    const evening = new Date(2026, 7, 18, 19).getTime()

    expect(await saveDailyLog(draft, morning)).toBe('created')
    expect(
      await saveDailyLog({ ...draft, ph: 6.3, notes: 'Evening' }, evening),
    ).toBe('updated')

    expect(await db.logs.count()).toBe(1)
    const saved = await db.logs.toCollection().first()
    expect(saved).toMatchObject({
      ph: 6.3,
      notes: 'Evening',
      timestamp: evening,
    })
  })
})
