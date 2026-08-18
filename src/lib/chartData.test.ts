import { describe, expect, it } from 'vitest'
import type { ReservoirLog } from '../db/database'
import { createDailyChartPoints, createReadingChartPoints } from './chartData'

function reading(id: number, timestamp: number, ph: number, ec: number): ReservoirLog {
  return {
    id,
    timestamp,
    updated_at: timestamp,
    ph,
    ec,
    water_temp: 21,
    water_added_liters: 0,
    notes: '',
  }
}

describe('irregular time-series chart data', () => {
  const morning = new Date(2026, 7, 18, 8).getTime()
  const noon = new Date(2026, 7, 18, 12).getTime()
  const evening = new Date(2026, 7, 18, 19).getTime()
  const tomorrow = new Date(2026, 7, 19, 9).getTime()
  const logs = [
    reading(3, evening, 6.4, 1.6),
    reading(4, tomorrow, 6.1, 1.3),
    reading(1, morning, 6.0, 1.2),
    reading(2, noon, 6.2, 1.4),
  ]

  it('keeps every reading at its exact timestamp in readings mode', () => {
    expect(createReadingChartPoints(logs).map((point) => point.timestamp))
      .toEqual([morning, noon, evening, tomorrow])
  })

  it('uses deterministic daily medians and min-max ranges', () => {
    const points = createDailyChartPoints(logs)

    expect(points).toHaveLength(2)
    expect(points[0]).toMatchObject({
      ph: 6.2,
      ec: 1.4,
      count: 3,
      phRange: [6.0, 6.4],
      ecRange: [1.2, 1.6],
    })
    expect(new Date(points[0].timestamp).getHours()).toBe(12)
  })

  it('does not mutate the source order', () => {
    createReadingChartPoints(logs)
    expect(logs.map((log) => log.id)).toEqual([3, 4, 1, 2])
  })
})
