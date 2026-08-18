import type { ReservoirLog } from '../db/database'
import { parseLocalDate, toLocalDateString } from './dates'

export type ChartMode = 'readings' | 'daily'

export interface ReservoirChartPoint {
  timestamp: number
  ph: number
  ec: number
  count: number
  phRange: [number, number]
  ecRange: [number, number]
}

function median(values: number[]): number {
  const ordered = [...values].sort((first, second) => first - second)
  const middle = Math.floor(ordered.length / 2)
  return ordered.length % 2
    ? ordered[middle]
    : (ordered[middle - 1] + ordered[middle]) / 2
}

function toChartPoint(logs: ReservoirLog[], timestamp: number): ReservoirChartPoint {
  const phValues = logs.map((log) => log.ph)
  const ecValues = logs.map((log) => log.ec)

  return {
    timestamp,
    ph: median(phValues),
    ec: median(ecValues),
    count: logs.length,
    phRange: [Math.min(...phValues), Math.max(...phValues)],
    ecRange: [Math.min(...ecValues), Math.max(...ecValues)],
  }
}

export function createReadingChartPoints(
  logs: ReservoirLog[],
): ReservoirChartPoint[] {
  return [...logs]
    .sort((first, second) => first.timestamp - second.timestamp)
    .map((log) => toChartPoint([log], log.timestamp))
}

export function createDailyChartPoints(
  logs: ReservoirLog[],
): ReservoirChartPoint[] {
  const logsByDay = new Map<string, ReservoirLog[]>()

  for (const log of logs) {
    const day = toLocalDateString(new Date(log.timestamp))
    const dayLogs = logsByDay.get(day)
    if (dayLogs) dayLogs.push(log)
    else logsByDay.set(day, [log])
  }

  return [...logsByDay.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([day, dayLogs]) => {
      const timestamp = parseLocalDate(day)
      timestamp.setHours(12)
      return toChartPoint(dayLogs, timestamp.getTime())
    })
}
