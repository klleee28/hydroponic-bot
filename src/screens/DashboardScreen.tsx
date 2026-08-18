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
import { db, type Crop } from '../db/database'
import {
  formatDueLabel,
  getNextDueDate,
  rangeStartTimestamp,
} from '../lib/dates'
import { latestLogPerLocalDay } from '../lib/logs'
import {
  evaluateThreshold,
  getOverallStatus,
  getSharedCropThresholds,
} from '../lib/thresholds'

interface DashboardScreenProps {
  reservoirCropIds: number[]
  onOpenLog: () => void
}

const ranges = [
  { id: '7d', label: '7D', days: 7 },
  { id: '30d', label: '30D', days: 30 },
  { id: '3m', label: '3M', days: 90 },
  { id: '6m', label: '6M', days: 180 },
  { id: 'all', label: 'All', days: null },
] as const

type RangeId = (typeof ranges)[number]['id']

export default function DashboardScreen({
  reservoirCropIds,
  onOpenLog,
}: DashboardScreenProps) {
  const [rangeId, setRangeId] = useState<RangeId>('30d')
  const activeRange = ranges.find((range) => range.id === rangeId) ?? ranges[1]
  const cropIdsKey = reservoirCropIds.join(',')
  const selectedCrops = useLiveQuery(
    async () => {
      const crops = await db.crops.bulkGet(reservoirCropIds)
      return crops.filter((crop): crop is Crop => Boolean(crop))
    },
    [cropIdsKey],
    [],
  )
  const latestLog = useLiveQuery(
    () => db.logs.orderBy('timestamp').last(),
    [],
  )
  const rawLogs = useLiveQuery(
    () => activeRange.days === null
      ? db.logs.orderBy('timestamp').toArray()
      : db.logs
          .where('timestamp')
          .aboveOrEqual(rangeStartTimestamp(activeRange.days))
          .sortBy('timestamp'),
    [rangeId],
    [],
  )
  const tasks = useLiveQuery(() => db.tasks.toArray(), [], [])
  const sharedThresholds = useMemo(
    () => getSharedCropThresholds(selectedCrops),
    [selectedCrops],
  )
  const logs = useMemo(() => latestLogPerLocalDay(rawLogs), [rawLogs])

  const overallStatus = useMemo(() => {
    if (!sharedThresholds) return null
    if (!sharedThresholds.compatible) return 'out-of-range'
    if (!latestLog) return null
    return getOverallStatus([
      evaluateThreshold(
        latestLog.ph,
        sharedThresholds.ph.minimum,
        sharedThresholds.ph.maximum,
      ).status,
      evaluateThreshold(
        latestLog.ec,
        sharedThresholds.ec.minimum,
        sharedThresholds.ec.maximum,
      ).status,
    ])
  }, [latestLog, sharedThresholds])

  const nextTask = useMemo(() => {
    return tasks
      .map((task) => ({
        task,
        due: getNextDueDate(task.last_completed_date, task.interval_days),
      }))
      .sort((a, b) => a.due.localeCompare(b.due))[0]
  }, [tasks])

  const statusCopy = !sharedThresholds?.compatible
    ? 'Selected crops have no shared safe range'
    : overallStatus === 'out-of-range'
      ? 'A reading is out of range'
      : overallStatus === 'near-limit'
        ? 'A reading is near its limit'
        : overallStatus === 'optimal'
          ? 'All readings in range'
          : 'Add your first reservoir reading'

  const cropSummary = selectedCrops.length === 1
    ? selectedCrops[0].name
    : selectedCrops.length === 2
      ? selectedCrops.map((crop) => crop.name).join(' + ')
      : `${selectedCrops[0]?.name ?? 'Reservoir'} + ${selectedCrops.length - 1} more`

  return (
    <div className="screen">
      <ScreenHeader
        title="Reservoir"
        subtitle={
          <>
            <strong className="crop-name">
              {cropSummary || 'Loading crops…'}
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

      <div
        className="segmented-control segmented-control--history"
        aria-label="Chart time range"
      >
        {ranges.map((range) => (
          <button
            key={range.id}
            type="button"
            aria-label={`${range.label} history`}
            aria-pressed={rangeId === range.id}
            onClick={() => setRangeId(range.id)}
          >
            {range.label}
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
