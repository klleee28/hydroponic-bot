import { Minus, Plus } from 'lucide-react'
import type { ThresholdResult } from '../lib/thresholds'
import { StatusPill } from './StatusPill'

interface NumericStepperProps {
  label: string
  unit?: string
  value: number
  step: number
  decimals: number
  minimum?: number
  maximum?: number
  threshold?: ThresholdResult
  targetText?: string
  onChange: (value: number) => void
}

function decimalPlaces(step: number): number {
  const text = String(step)
  return text.includes('.') ? text.split('.')[1].length : 0
}

export function NumericStepper({
  label,
  unit,
  value,
  step,
  decimals,
  minimum = 0,
  maximum = Number.POSITIVE_INFINITY,
  threshold,
  targetText,
  onChange,
}: NumericStepperProps) {
  const precision = Math.max(decimals, decimalPlaces(step))

  const changeBy = (direction: -1 | 1) => {
    const next = Math.min(maximum, Math.max(minimum, value + step * direction))
    onChange(Number(next.toFixed(precision)))
  }

  return (
    <div
      className={`stepper-row${threshold ? ` stepper-row--${threshold.status}` : ''}`}
    >
      <div className="stepper-row__label">
        <span>{label}</span>
        {unit ? <small>{unit}</small> : null}
      </div>
      <button
        type="button"
        className="stepper-button"
        aria-label={`Decrease ${label} by ${step}`}
        onClick={() => changeBy(-1)}
      >
        <Minus size={24} strokeWidth={2.2} aria-hidden="true" />
      </button>
      <div className="stepper-value" aria-live="polite">
        <strong>{value.toFixed(decimals)}</strong>
        <span>Step {step}</span>
      </div>
      <button
        type="button"
        className="stepper-button"
        aria-label={`Increase ${label} by ${step}`}
        onClick={() => changeBy(1)}
      >
        <Plus size={24} strokeWidth={2.2} aria-hidden="true" />
      </button>
      <div className="stepper-status">
        {threshold ? (
          <StatusPill status={threshold.status} label={threshold.label} />
        ) : null}
        {targetText ? <small>{targetText}</small> : null}
      </div>
    </div>
  )
}
