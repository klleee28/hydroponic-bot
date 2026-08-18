export type ReadingStatus = 'optimal' | 'near-limit' | 'out-of-range'

export interface ThresholdResult {
  status: ReadingStatus
  label: 'Optimal' | 'Near limit' | 'Out of range'
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
