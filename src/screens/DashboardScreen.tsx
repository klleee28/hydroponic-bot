import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  CheckCircle2,
  CircleAlert,
  Droplets,
  FlaskConical,
  Thermometer,
  Wrench,
} from 'lucide-react'
import { ReservoirChart } from '../components/ReservoirChart'
import { ScreenHeader } from '../components/ScreenHeader'
import { db } from '../db/database'
import {
  formatDueLabel,
  getNextDueDate,
  rangeStartTimestamp,
} from '../lib/dates'
import { evaluateThreshold, getOverallStatus } from '../lib/thresholds'

interface DashboardScreenProps {
  activeCropId: number
  onOpenLog: () => void
}

const ranges = [7, 14, 30] as const

export default function DashboardScreen({
  activeCropId,
  onOpenLog,
}: DashboardScreenProps) {
  const [days, setDays] = useState<(typeof ranges)[number]>(7)
  const activeCrop = useLiveQuery(() => db.crops.get(activeCropId), [activeCropId])
  const latestLog = useLiveQuery(
    () => db.logs.orderBy('timestamp').last(),
    [],
  )
  const logs = useLiveQuery(
    () =>
      db.logs
        .where('timestamp')
        .aboveOrEqual(rangeStartTimestamp(days))
        .sortBy('timestamp'),
    [days],
    [],
  )
  const tasks = useLiveQuery(() => db.tasks.toArray(), [], [])

  const overallStatus = useMemo(() => {
    if (!activeCrop || !latestLog) return null
    return getOverallStatus([
      evaluateThreshold(
        latestLog.ph,
        activeCrop.target_ph_min,
        activeCrop.target_ph_max,
      ).status,
      evaluateThreshold(
        latestLog.ec,
        activeCrop.target_ec_min,
        activeCrop.target_ec_max,
      ).status,
    ])
  }, [activeCrop, latestLog])

  const nextTask = useMemo(() => {
    return tasks
      .map((task) => ({
        task,
        due: getNextDueDate(task.last_completed_date, task.interval_days),
      }))
      .sort((a, b) => a.due.localeCompare(b.due))[0]
  }, [tasks])

  const statusCopy =
    overallStatus === 'out-of-range'
      ? 'A reading is out of range'
      : overallStatus === 'near-limit'
        ? 'A reading is near its limit'
        : overallStatus === 'optimal'
          ? 'All readings in range'
          : 'Add your first reservoir reading'

  return (
    <div className="screen">
      <ScreenHeader
        title="Reservoir"
        subtitle={
          <>
            <strong className="crop-name">
              {activeCrop?.name ?? 'Loading crop…'}
            </strong>
            <div className={`overall-status overall-status--${overallStatus ?? 'empty'}`}>
              {overallStatus === 'optimal' ? (
                <CheckCircle2 size={21} aria-hidden="true" />
              ) : (
                <CircleAlert size={21} aria-hidden="true" />
              )}
              <span>{statusCopy}</span>
            </div>
          </>
        }
      />

      <div className="segmented-control" aria-label="Chart time range">
        {ranges.map((range) => (
          <button
            key={range}
            type="button"
            aria-pressed={days === range}
            onClick={() => setDays(range)}
          >
            {range} Days
          </button>
        ))}
      </div>

      {logs.length ? (
        <ReservoirChart logs={logs} />
      ) : (
        <section className="empty-chart">
          <Droplets size={36} strokeWidth={1.7} aria-hidden="true" />
          <h2>No readings yet</h2>
          <p>Your pH and EC history will appear here after the first log.</p>
          <button type="button" className="secondary-button" onClick={onOpenLog}>
            Add first log
          </button>
        </section>
      )}

      <section className="reading-list" aria-label="Latest readings">
        <div className="reading-row">
          <FlaskConical size={20} color="#008b8f" aria-hidden="true" />
          <span>pH</span>
          <strong>{latestLog ? latestLog.ph.toFixed(1) : '—'}</strong>
        </div>
        <div className="reading-row">
          <Droplets size={20} color="#2457c5" aria-hidden="true" />
          <span>EC (mS/cm)</span>
          <strong>{latestLog ? latestLog.ec.toFixed(2) : '—'}</strong>
        </div>
        <div className="reading-row">
          <Thermometer size={20} color="#12313a" aria-hidden="true" />
          <span>Water temperature</span>
          <strong>{latestLog ? `${latestLog.water_temp.toFixed(1)}°` : '—'}</strong>
        </div>
      </section>

      <section className="maintenance-card">
        <div className="maintenance-card__icon">
          <Wrench size={27} aria-hidden="true" />
        </div>
        <div>
          <span>Next maintenance</span>
          <strong>{nextTask?.task.title ?? 'No maintenance tasks'}</strong>
          {nextTask ? <em>{formatDueLabel(nextTask.due)}</em> : null}
        </div>
      </section>
    </div>
  )
}
