import type { ReadingStatus } from '../lib/thresholds'

interface StatusPillProps {
  status: ReadingStatus
  label: string
}

export function StatusPill({ status, label }: StatusPillProps) {
  return <span className={`status-pill status-pill--${status}`}>{label}</span>
}
