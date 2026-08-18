import type { Crop } from '../db/database'

export type ReadingStatus = 'optimal' | 'near-limit' | 'out-of-range'

export interface ThresholdResult {
  status: ReadingStatus
  label: 'Optimal' | 'Near limit' | 'Out of range'
}

export interface SharedRange {
  minimum: number
  maximum: number
  compatible: boolean
}

export interface SharedCropThresholds {
  ph: SharedRange
  ec: SharedRange
  compatible: boolean
}

type CropThresholds = Pick<
  Crop,
  | 'target_ph_min'
  | 'target_ph_max'
  | 'target_ec_min'
  | 'target_ec_max'
>

export function getSharedCropThresholds(
  crops: CropThresholds[],
): SharedCropThresholds | null {
  if (!crops.length) return null

  let phMinimum = crops[0].target_ph_min
  let phMaximum = crops[0].target_ph_max
  let ecMinimum = crops[0].target_ec_min
  let ecMaximum = crops[0].target_ec_max

  for (let index = 1; index < crops.length; index += 1) {
    const crop = crops[index]
    phMinimum = Math.max(phMinimum, crop.target_ph_min)
    phMaximum = Math.min(phMaximum, crop.target_ph_max)
    ecMinimum = Math.max(ecMinimum, crop.target_ec_min)
    ecMaximum = Math.min(ecMaximum, crop.target_ec_max)
  }

  const ph = {
    minimum: phMinimum,
    maximum: phMaximum,
    compatible: phMinimum < phMaximum,
  }
  const ec = {
    minimum: ecMinimum,
    maximum: ecMaximum,
    compatible: ecMinimum < ecMaximum,
  }

  return { ph, ec, compatible: ph.compatible && ec.compatible }
}

export function evaluateThreshold(
  value: number,
  minimum: number,
  maximum: number,
): ThresholdResult {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    return { status: 'out-of-range', label: 'Out of range' }
  }

  const span = maximum - minimum
  if (span <= 0) {
    return { status: 'out-of-range', label: 'Out of range' }
  }

  const warningBand = span * 0.1
  if (value <= minimum + warningBand || value >= maximum - warningBand) {
    return { status: 'near-limit', label: 'Near limit' }
  }

  return { status: 'optimal', label: 'Optimal' }
}

export function getOverallStatus(
  statuses: ReadingStatus[],
): ReadingStatus {
  if (statuses.includes('out-of-range')) return 'out-of-range'
  if (statuses.includes('near-limit')) return 'near-limit'
  return 'optimal'
}
