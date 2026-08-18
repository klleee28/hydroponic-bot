import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CheckCircle2, Clock3, Pencil, Trash2 } from 'lucide-react'
import { BackupReminder } from '../components/BackupReminder'
import { Modal } from '../components/Modal'
import { NumericStepper } from '../components/NumericStepper'
import { ScreenHeader } from '../components/ScreenHeader'
import { db, type Crop, type ReservoirLog } from '../db/database'
import { isBackupDue } from '../lib/backupSchedule'
import {
  formatReadingTime,
  getLocalDayBounds,
  parseLocalDateTimeInput,
  toLocalDateTimeInput,
} from '../lib/dates'
import {
  createReservoirLog,
  deleteReservoirLog,
  updateReservoirLog,
  type ReservoirLogDraft,
} from '../lib/logs'
import { evaluateThreshold, getSharedCropThresholds } from '../lib/thresholds'

interface LogScreenProps {
  reservoirCropIds: number[]
  lastBackupAt: number | null
  onBackupCompleted: (timestamp: number) => void
}

type LogForm = ReservoirLogDraft
type SavedAction = 'created' | 'updated' | 'deleted'

function midpoint(minimum: number, maximum: number, decimals: number): number {
  return Number(((minimum + maximum) / 2).toFixed(decimals))
}

function formFromLog(log: ReservoirLog): LogForm {
  return {
    ph: log.ph,
    ec: log.ec,
    water_temp: log.water_temp,
    water_added_liters: log.water_added_liters,
    notes: log.notes,
  }
}

export default function LogScreen({
  reservoirCropIds,
  lastBackupAt,
  onBackupCompleted,
}: LogScreenProps) {
  const cropIdsKey = reservoirCropIds.join(',')
  const selectedCrops = useLiveQuery(
    async () => {
      const crops = await db.crops.bulkGet(reservoirCropIds)
      return crops.filter((crop): crop is Crop => Boolean(crop))
    },
    [cropIdsKey],
    [],
  )
  const logState = useLiveQuery(
    async () => {
      const { start, end } = getLocalDayBounds()
      const [todayLogs, latestLog] = await Promise.all([
        db.logs
          .where('timestamp')
          .between(start, end, true, false)
          .reverse()
          .toArray(),
        db.logs.orderBy('timestamp').last(),
      ])
      return { todayLogs, latestLog: latestLog ?? null }
    },
    [],
  )
  const [form, setForm] = useState<LogForm | null>(null)
  const [measurementTime, setMeasurementTime] = useState(() =>
    toLocalDateTimeInput(),
  )
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingTimestamp, setEditingTimestamp] = useState<number | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ReservoirLog | null>(null)
  const [savedAction, setSavedAction] = useState<SavedAction | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const sharedThresholds = useMemo(
    () => getSharedCropThresholds(selectedCrops),
    [selectedCrops],
  )

  useEffect(() => {
    if (!sharedThresholds || !logState || form) return

    setForm(
      logState.latestLog
        ? { ...formFromLog(logState.latestLog), notes: '' }
        : {
            ph: midpoint(
              sharedThresholds.ph.minimum,
              sharedThresholds.ph.maximum,
              1,
            ),
            ec: midpoint(
              sharedThresholds.ec.minimum,
              sharedThresholds.ec.maximum,
              2,
            ),
            water_temp: 21,
            water_added_liters: 0,
            notes: '',
          },
    )
  }, [form, logState, sharedThresholds])

  const thresholds = useMemo(() => {
    if (!sharedThresholds || !form) return null
    return {
      ph: evaluateThreshold(
        form.ph,
        sharedThresholds.ph.minimum,
        sharedThresholds.ph.maximum,
      ),
      ec: evaluateThreshold(
        form.ec,
        sharedThresholds.ec.minimum,
        sharedThresholds.ec.maximum,
      ),
    }
  }, [form, sharedThresholds])

  const setValue = (key: keyof LogForm, value: number | string) => {
    setSavedAction(null)
    setFormError(null)
    setForm((current) => (current ? { ...current, [key]: value } : current))
  }

  const startNewReading = (source: LogForm) => {
    setEditingId(null)
    setEditingTimestamp(null)
    setForm({ ...source, notes: '' })
    setMeasurementTime(toLocalDateTimeInput())
    setFormError(null)
  }

  const editReading = (log: ReservoirLog) => {
    setEditingId(log.id)
    setEditingTimestamp(log.timestamp)
    setForm(formFromLog(log))
    setMeasurementTime(toLocalDateTimeInput(new Date(log.timestamp)))
    setSavedAction(null)
    setFormError(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const saveLog = async () => {
    if (!form) return
    const parsedTimestamp = parseLocalDateTimeInput(measurementTime)
    if (parsedTimestamp === null) {
      setFormError('Choose a valid measurement date and time.')
      return
    }

    const timestamp = editingTimestamp !== null
      && measurementTime === toLocalDateTimeInput(new Date(editingTimestamp))
      ? editingTimestamp
      : parsedTimestamp

    const updatedAt = Date.now()
    if (editingId === null) {
      await createReservoirLog(form, timestamp, updatedAt)
      setSavedAction('created')
    } else {
      await updateReservoirLog(editingId, form, timestamp, updatedAt)
      setSavedAction('updated')
    }
    startNewReading(form)
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    await deleteReservoirLog(pendingDelete.id)
    if (editingId === pendingDelete.id && form) startNewReading(form)
    setPendingDelete(null)
    setSavedAction('deleted')
  }

  if (!sharedThresholds || !logState || !form || !thresholds) {
    return (
      <div className="screen">
        <ScreenHeader title="Log Reading" subtitle="Preparing your latest values…" />
      </div>
    )
  }

  return (
    <div className="screen screen--flush">
      <div className="screen-padding">
        <ScreenHeader
          title={editingId === null ? 'Log Reading' : 'Edit Reading'}
          subtitle={editingId === null
            ? 'Each save creates a separate timestamped measurement'
            : `Editing the ${formatReadingTime(parseLocalDateTimeInput(measurementTime) ?? Date.now())} measurement`}
        />
      </div>

      {!sharedThresholds.compatible ? (
        <div className="range-conflict range-conflict--log" role="alert">
          These crops have no overlapping safe range. Adjust their crop
          thresholds or reservoir membership in Settings.
        </div>
      ) : null}

      <section className="stepper-list" aria-label="Reservoir readings">
        <NumericStepper
          label="pH"
          value={form.ph}
          step={0.1}
          decimals={1}
          maximum={14}
          threshold={thresholds.ph}
          targetText={sharedThresholds.ph.compatible
            ? `${sharedThresholds.ph.minimum.toFixed(1)}–${sharedThresholds.ph.maximum.toFixed(1)}`
            : 'No overlap'}
          onChange={(value) => setValue('ph', value)}
        />
        <NumericStepper
          label="EC"
          unit="mS/cm"
          value={form.ec}
          step={0.05}
          decimals={2}
          maximum={10}
          threshold={thresholds.ec}
          targetText={sharedThresholds.ec.compatible
            ? `${sharedThresholds.ec.minimum.toFixed(2)}–${sharedThresholds.ec.maximum.toFixed(2)}`
            : 'No overlap'}
          onChange={(value) => setValue('ec', value)}
        />
        <NumericStepper
          label="Water temp"
          unit="°C"
          value={form.water_temp}
          step={0.1}
          decimals={1}
          maximum={50}
          onChange={(value) => setValue('water_temp', value)}
        />
        <NumericStepper
          label="Water added"
          unit="L"
          value={form.water_added_liters}
          step={0.1}
          decimals={1}
          maximum={999}
          onChange={(value) => setValue('water_added_liters', value)}
        />
      </section>

      <div className="screen-padding log-actions">
        <label className="measurement-time" htmlFor="measurement-time">
          <span><Clock3 size={18} aria-hidden="true" /> Measurement time</span>
          <input
            id="measurement-time"
            type="datetime-local"
            value={measurementTime}
            onInput={(event) => {
              setMeasurementTime(event.currentTarget.value)
              setSavedAction(null)
              setFormError(null)
            }}
          />
        </label>
        <label className="field-label" htmlFor="notes">Notes</label>
        <textarea
          id="notes"
          className="notes-field"
          value={form.notes}
          placeholder="Add any notes…"
          rows={3}
          onChange={(event) => setValue('notes', event.target.value)}
        />
        <button type="button" className="primary-button" onClick={saveLog}>
          {editingId === null ? 'Save New Reading' : 'Update Reading'}
        </button>
        {editingId !== null ? (
          <button
            type="button"
            className="secondary-button"
            onClick={() => startNewReading(form)}
          >
            Cancel edit
          </button>
        ) : null}
        {formError ? <p className="data-error" role="alert">{formError}</p> : null}
        {savedAction ? (
          <div className="save-confirmation" role="status">
            <CheckCircle2 size={19} aria-hidden="true" />
            {savedAction === 'created'
              ? 'New reading saved locally'
              : savedAction === 'updated'
                ? 'Reading updated locally'
                : 'Reading deleted locally'}
          </div>
        ) : null}
        {savedAction && savedAction !== 'deleted' && isBackupDue(lastBackupAt) ? (
          <BackupReminder
            reservoirCropIds={reservoirCropIds}
            onBackupCompleted={onBackupCompleted}
          />
        ) : null}
      </div>

      <section className="today-readings screen-padding" aria-labelledby="today-readings-title">
        <div className="today-readings__heading">
          <div>
            <h2 id="today-readings-title">Today’s readings</h2>
            <p>{logState.todayLogs.length} recorded</p>
          </div>
        </div>
        {logState.todayLogs.length ? (
          <div className="today-readings__list">
            {logState.todayLogs.map((log) => (
              <article className="today-reading" key={log.id}>
                <time dateTime={new Date(log.timestamp).toISOString()}>
                  {formatReadingTime(log.timestamp)}
                </time>
                <div>
                  <strong>pH {log.ph.toFixed(1)}</strong>
                  <span>EC {log.ec.toFixed(2)} · {log.water_temp.toFixed(1)}°C</span>
                </div>
                <button
                  type="button"
                  aria-label={`Edit ${formatReadingTime(log.timestamp)} reading`}
                  onClick={() => editReading(log)}
                >
                  <Pencil size={18} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="today-reading__delete"
                  aria-label={`Delete ${formatReadingTime(log.timestamp)} reading`}
                  onClick={() => setPendingDelete(log)}
                >
                  <Trash2 size={18} aria-hidden="true" />
                </button>
              </article>
            ))}
          </div>
        ) : (
          <p className="today-readings__empty">No measurements recorded today.</p>
        )}
      </section>

      {pendingDelete ? (
        <Modal title="Delete this reading?" onClose={() => setPendingDelete(null)}>
          <div className="restore-warning" role="alert">
            The {formatReadingTime(pendingDelete.timestamp)} measurement will be
            permanently removed from this device.
          </div>
          <div className="restore-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setPendingDelete(null)}
            >
              Cancel
            </button>
            <button type="button" className="danger-button" onClick={confirmDelete}>
              Delete reading
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
