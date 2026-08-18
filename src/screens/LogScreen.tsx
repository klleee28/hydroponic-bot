import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CheckCircle2 } from 'lucide-react'
import { NumericStepper } from '../components/NumericStepper'
import { ScreenHeader } from '../components/ScreenHeader'
import { db, type ReservoirLog } from '../db/database'
import { evaluateThreshold } from '../lib/thresholds'

interface LogScreenProps {
  activeCropId: number
}

type LogForm = Omit<ReservoirLog, 'id' | 'timestamp'>

function midpoint(minimum: number, maximum: number, decimals: number): number {
  return Number(((minimum + maximum) / 2).toFixed(decimals))
}

export default function LogScreen({ activeCropId }: LogScreenProps) {
  const activeCrop = useLiveQuery(() => db.crops.get(activeCropId), [activeCropId])
  const latestLog = useLiveQuery(
    async () => (await db.logs.orderBy('timestamp').last()) ?? null,
    [],
  )
  const [form, setForm] = useState<LogForm | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!activeCrop || latestLog === undefined || form) return

    setForm(
      latestLog
        ? {
            ph: latestLog.ph,
            ec: latestLog.ec,
            water_temp: latestLog.water_temp,
            ambient_temp: latestLog.ambient_temp,
            water_added_liters: latestLog.water_added_liters,
            notes: '',
          }
        : {
            ph: midpoint(activeCrop.target_ph_min, activeCrop.target_ph_max, 1),
            ec: midpoint(activeCrop.target_ec_min, activeCrop.target_ec_max, 2),
            water_temp: 21,
            ambient_temp: 24,
            water_added_liters: 0,
            notes: '',
          },
    )
  }, [activeCrop, form, latestLog])

  const thresholds = useMemo(() => {
    if (!activeCrop || !form) return null
    return {
      ph: evaluateThreshold(
        form.ph,
        activeCrop.target_ph_min,
        activeCrop.target_ph_max,
      ),
      ec: evaluateThreshold(
        form.ec,
        activeCrop.target_ec_min,
        activeCrop.target_ec_max,
      ),
    }
  }, [activeCrop, form])

  const setValue = (key: keyof LogForm, value: number | string) => {
    setSaved(false)
    setForm((current) => (current ? { ...current, [key]: value } : current))
  }

  const saveLog = async () => {
    if (!form) return
    await db.logs.add({
      ...form,
      timestamp: Date.now(),
    })
    setSaved(true)
  }

  if (!activeCrop || !form || !thresholds) {
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
          subtitle={latestLog ? 'Based on your last entry' : 'Starting with crop midpoints'}
        />
      </div>

      <section className="stepper-list" aria-label="Reservoir readings">
        <NumericStepper
          label="pH"
          value={form.ph}
          step={0.1}
          decimals={1}
          maximum={14}
          threshold={thresholds.ph}
          targetText={`${activeCrop.target_ph_min.toFixed(1)}–${activeCrop.target_ph_max.toFixed(1)}`}
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
          targetText={`${activeCrop.target_ec_min.toFixed(1)}–${activeCrop.target_ec_max.toFixed(1)}`}
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
          Save Log
        </button>
        {saved ? (
          <div className="save-confirmation" role="status">
            <CheckCircle2 size={19} aria-hidden="true" />
            Saved locally on this iPhone
          </div>
        ) : null}
      </div>
    </div>
  )
}
