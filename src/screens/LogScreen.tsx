import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CheckCircle2 } from 'lucide-react'
import { NumericStepper } from '../components/NumericStepper'
import { ScreenHeader } from '../components/ScreenHeader'
import { db, type Crop, type ReservoirLog } from '../db/database'
import { getLocalDayBounds } from '../lib/dates'
import { saveDailyLog } from '../lib/logs'
import { evaluateThreshold, getSharedCropThresholds } from '../lib/thresholds'

interface LogScreenProps {
  reservoirCropIds: number[]
}

type LogForm = Omit<ReservoirLog, 'id' | 'timestamp'>

function midpoint(minimum: number, maximum: number, decimals: number): number {
  return Number(((minimum + maximum) / 2).toFixed(decimals))
}

export default function LogScreen({ reservoirCropIds }: LogScreenProps) {
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
      const [todayLog, latestLog] = await Promise.all([
        db.logs.where('timestamp').between(start, end, true, false).last(),
        db.logs.orderBy('timestamp').last(),
      ])
      return {
        todayLog: todayLog ?? null,
        latestLog: latestLog ?? null,
      }
    },
    [],
  )
  const [form, setForm] = useState<LogForm | null>(null)
  const [savedAction, setSavedAction] = useState<'created' | 'updated' | null>(null)
  const sharedThresholds = useMemo(
    () => getSharedCropThresholds(selectedCrops),
    [selectedCrops],
  )

  useEffect(() => {
    if (!sharedThresholds || !logState || form) return

    const prefillLog = logState.todayLog ?? logState.latestLog

    setForm(
      prefillLog
        ? {
            ph: prefillLog.ph,
            ec: prefillLog.ec,
            water_temp: prefillLog.water_temp,
            ambient_temp: prefillLog.ambient_temp,
            water_added_liters: prefillLog.water_added_liters,
            notes: logState.todayLog ? prefillLog.notes : '',
          }
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
            ambient_temp: 24,
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
    setForm((current) => (current ? { ...current, [key]: value } : current))
  }

  const saveLog = async () => {
    if (!form) return
    setSavedAction(await saveDailyLog(form))
  }

  if (!sharedThresholds || !logState || !form || !thresholds) {
    return (
      <div className="screen">
        <ScreenHeader title="Daily Log" subtitle="Preparing your latest values…" />
      </div>
    )
  }

  return (
    <div className="screen screen--flush">
      <div className="screen-padding">
        <ScreenHeader
          title="Daily Log"
          subtitle={
            logState.todayLog
              ? 'Editing today’s saved reservoir reading'
              : logState.latestLog
                ? 'Based on your most recent reading'
                : 'Starting with the shared crop midpoint'
          }
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
          label="Ambient temp"
          unit="°C"
          value={form.ambient_temp}
          step={0.1}
          decimals={1}
          maximum={60}
          onChange={(value) => setValue('ambient_temp', value)}
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
          {logState.todayLog ? 'Update Today’s Log' : 'Save Today’s Log'}
        </button>
        {savedAction ? (
          <div className="save-confirmation" role="status">
            <CheckCircle2 size={19} aria-hidden="true" />
            {savedAction === 'updated' ? 'Today’s reading updated' : 'Today’s reading saved'} locally
          </div>
        ) : null}
      </div>
    </div>
  )
}
