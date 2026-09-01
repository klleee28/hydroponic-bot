import { useEffect, useState } from 'react'
import { CheckCircle2, Circle, FlaskConical, Gauge, ThermometerSun } from 'lucide-react'
import type { SeedlingBatch } from '../db/database'
import {
  getCareCriteria,
  getPropagationDefaults,
  PROPAGATION_EC_TOLERANCE,
} from '../lib/seedlings'
import type { ThresholdResult } from '../lib/thresholds'
import { formatReadingDateTime } from '../lib/dates'
import { NumericStepper } from './NumericStepper'

interface PropagationCareProps {
  batch: SeedlingBatch
  cropName: string
  onChange: (batch: SeedlingBatch) => void
}

type CareBooleanKey =
  | 'plug_evenly_moist'
  | 'complete_nutrient_prepared'
  | 'dome_removed'
  | 'light_provided'

function simpleThreshold(matches: boolean): ThresholdResult {
  return matches
    ? { status: 'optimal', label: 'Optimal' }
    : { status: 'out-of-range', label: 'Out of range' }
}

function parseOptionalDecimal(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value.trim().replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

export function PropagationCare({
  batch,
  cropName,
  onChange,
}: PropagationCareProps) {
  const [phMinInput, setPhMinInput] = useState<string>(
    batch.propagation_ph_min !== null ? String(batch.propagation_ph_min) : '',
  )
  const [phMaxInput, setPhMaxInput] = useState<string>(
    batch.propagation_ph_max !== null ? String(batch.propagation_ph_max) : '',
  )
  const [ecTargetInput, setEcTargetInput] = useState<string>(
    batch.propagation_ec_target !== null ? String(batch.propagation_ec_target) : '',
  )

  useEffect(() => {
    setPhMinInput(
      batch.propagation_ph_min !== null ? String(batch.propagation_ph_min) : '',
    )
    setPhMaxInput(
      batch.propagation_ph_max !== null ? String(batch.propagation_ph_max) : '',
    )
    setEcTargetInput(
      batch.propagation_ec_target !== null ? String(batch.propagation_ec_target) : '',
    )
  }, [batch.id, batch.propagation_ph_min, batch.propagation_ph_max, batch.propagation_ec_target])

  const handlePhMinChange = (value: string) => {
    setPhMinInput(value)
    onChange({
      ...batch,
      propagation_ph_min: parseOptionalDecimal(value),
    })
  }

  const handlePhMaxChange = (value: string) => {
    setPhMaxInput(value)
    onChange({
      ...batch,
      propagation_ph_max: parseOptionalDecimal(value),
    })
  }

  const handleEcTargetChange = (value: string) => {
    setEcTargetInput(value)
    onChange({
      ...batch,
      propagation_ec_target: parseOptionalDecimal(value),
    })
  }
  const guide = getPropagationDefaults(cropName)
  const criteria = getCareCriteria(batch)
  const completedCount = criteria.filter((criterion) => criterion.met).length
  const phTargetsValid = batch.propagation_ph_min !== null
    && batch.propagation_ph_max !== null
    && batch.propagation_ph_min < batch.propagation_ph_max
  const ecTargetValid = batch.propagation_ec_target !== null
    && batch.propagation_ec_target >= 0
  const targetsValid = phTargetsValid && ecTargetValid
  const hasSolutionReading = batch.propagation_ph !== null
    && batch.propagation_ec !== null

  const phThreshold = hasSolutionReading && phTargetsValid
    ? simpleThreshold(
        batch.propagation_ph! >= batch.propagation_ph_min!
        && batch.propagation_ph! <= batch.propagation_ph_max!,
      )
    : undefined
  const ecThreshold = hasSolutionReading && ecTargetValid
    ? simpleThreshold(
        Math.abs(batch.propagation_ec! - batch.propagation_ec_target!)
          <= PROPAGATION_EC_TOLERANCE + Number.EPSILON,
      )
    : undefined

  const updateBoolean = (key: CareBooleanKey, checked: boolean) => {
    onChange({ ...batch, [key]: checked })
  }

  const startSolutionCheck = () => {
    if (!targetsValid) return
    onChange({
      ...batch,
      propagation_ph: batch.propagation_ph
        ?? Number(((batch.propagation_ph_min! + batch.propagation_ph_max!) / 2).toFixed(1)),
      propagation_ec: batch.propagation_ec ?? batch.propagation_ec_target,
      solution_checked_at: Date.now(),
    })
  }

  const updateSolution = (
    key: 'propagation_ph' | 'propagation_ec',
    value: number,
  ) => {
    onChange({
      ...batch,
      [key]: value,
      solution_checked_at: Date.now(),
    })
  }

  return (
    <section className="progress-section propagation-care">
      <div className="section-heading-row">
        <div>
          <h3>Germination & seedling care</h3>
          <p>{completedCount}/{criteria.length} care checks complete</p>
        </div>
      </div>

      {guide.sourceUrl ? (
        <div className="propagation-preset">
          <FlaskConical size={22} aria-hidden="true" />
          <div>
            <strong>Lettuce propagation preset</strong>
            <span>pH 5.5–6.0 · EC 1.00 mS/cm</span>
            <small>
              <ThermometerSun size={14} aria-hidden="true" /> 20°C germination · humidity above 88%
            </small>
          </div>
          <a href={guide.sourceUrl} target="_blank" rel="noreferrer">Source</a>
        </div>
      ) : (
        <p className="custom-propagation-note">
          This crop has no sourced propagation preset. Enter targets from your
          seed or nutrient supplier before recording a solution check.
        </p>
      )}

      <details className="propagation-targets" open={!targetsValid}>
        <summary>Propagation targets</summary>
        <div>
          <label>
            <span>pH minimum</span>
            <input
              inputMode="decimal"
              value={phMinInput}
              onChange={(event) => handlePhMinChange(event.target.value)}
            />
          </label>
          <label>
            <span>pH maximum</span>
            <input
              inputMode="decimal"
              value={phMaxInput}
              onChange={(event) => handlePhMaxChange(event.target.value)}
            />
          </label>
          <label>
            <span>EC target</span>
            <input
              inputMode="decimal"
              value={ecTargetInput}
              onChange={(event) => handleEcTargetChange(event.target.value)}
            />
          </label>
        </div>
        {!targetsValid ? <small>Enter a valid pH range and EC target.</small> : null}
      </details>

      <div className="care-check-list">
        <label className="readiness-check">
          <input
            type="checkbox"
            checked={batch.plug_evenly_moist}
            onChange={(event) => updateBoolean('plug_evenly_moist', event.target.checked)}
          />
          <span>
            <strong>Plugs evenly moist, not flooded</strong>
            <small>Moisture supports germination; standing water reduces root-zone air.</small>
          </span>
        </label>
        <label className="readiness-check">
          <input
            type="checkbox"
            checked={batch.complete_nutrient_prepared}
            onChange={(event) => updateBoolean('complete_nutrient_prepared', event.target.checked)}
          />
          <span>
            <strong>Mild complete nutrient ready for seedling stage</strong>
            <small>
              {guide.sourceUrl
                ? 'For lettuce rockwool, pre-charge at the sourced targets.'
                : 'Seeds use stored energy; apply nutrients after emergence per supplier guidance.'}
            </small>
          </span>
        </label>
        {batch.emerged_at !== null ? (
          <>
            <label className="readiness-check">
              <input
                type="checkbox"
                checked={batch.dome_removed}
                onChange={(event) => updateBoolean('dome_removed', event.target.checked)}
              />
              <span><strong>Humidity dome removed or not used</strong></span>
            </label>
            <label className="readiness-check">
              <input
                type="checkbox"
                checked={batch.light_provided}
                onChange={(event) => updateBoolean('light_provided', event.target.checked)}
              />
              <span><strong>Seedling light provided</strong></span>
            </label>
          </>
        ) : null}
      </div>

      {hasSolutionReading ? (
        <>
          <div className="stepper-list propagation-steppers">
            <NumericStepper
              label="pH"
              value={batch.propagation_ph!}
              step={0.1}
              decimals={1}
              maximum={14}
              threshold={phThreshold}
              targetText={phTargetsValid
                ? `${batch.propagation_ph_min!.toFixed(1)}–${batch.propagation_ph_max!.toFixed(1)}`
                : 'Set target'}
              onChange={(value) => updateSolution('propagation_ph', value)}
            />
            <NumericStepper
              label="EC"
              unit="mS/cm"
              value={batch.propagation_ec!}
              step={0.05}
              decimals={2}
              threshold={ecThreshold}
              targetText={ecTargetValid
                ? `${batch.propagation_ec_target!.toFixed(2)} ±0.05`
                : 'Set target'}
              onChange={(value) => updateSolution('propagation_ec', value)}
            />
          </div>
          <p className="solution-check-time">
            <Gauge size={15} aria-hidden="true" />
            Latest solution check · {batch.solution_checked_at
              ? formatReadingDateTime(batch.solution_checked_at)
              : 'Not timestamped'}
          </p>
        </>
      ) : (
        <button
          type="button"
          className="record-solution-button"
          disabled={!targetsValid}
          onClick={startSolutionCheck}
        >
          <Gauge size={19} aria-hidden="true" /> Record pH & EC check
        </button>
      )}

      <div className="care-criteria-summary" aria-label="Care criteria status">
        {criteria.map((criterion) => (
          <div key={criterion.id} className={criterion.met ? 'is-complete' : ''}>
            {criterion.met
              ? <CheckCircle2 size={19} aria-hidden="true" />
              : <Circle size={19} aria-hidden="true" />}
            <span>{criterion.label}</span>
          </div>
        ))}
      </div>

      <p className="care-not-transfer-rule">
        EC is accepted within one 0.05 mS/cm app step of the target.{' '}
        Care checks document how the batch was raised. They do not override the
        separate leaf, root, plug, and health requirements for NFT transfer.
      </p>
    </section>
  )
}
