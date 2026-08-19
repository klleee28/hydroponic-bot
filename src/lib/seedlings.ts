import type { SeedlingBatch, SeedlingStage } from '../db/database'
import { parseLocalDate, toLocalDateString } from './dates'

const DAY_MS = 86_400_000

export interface ReadinessCriterion {
  id: 'emerged' | 'leaves' | 'roots' | 'plug' | 'health'
  label: string
  met: boolean
}

export function suggestedTrueLeaves(cropName: string): number {
  return cropName.toLocaleLowerCase().includes('lettuce') ? 3 : 2
}

export function getBatchDay(sownAt: number, now: Date = new Date()): number {
  const sowDate = parseLocalDate(toLocalDateString(new Date(sownAt)))
  const today = parseLocalDate(toLocalDateString(now))
  return Math.max(0, Math.round((today.getTime() - sowDate.getTime()) / DAY_MS))
}

export function getReadinessCriteria(
  batch: Pick<
    SeedlingBatch,
    | 'emerged_at'
    | 'true_leaf_count'
    | 'target_true_leaves'
    | 'roots_visible'
    | 'plug_stable'
    | 'healthy'
  >,
): ReadinessCriterion[] {
  return [
    { id: 'emerged', label: 'Seedlings have emerged', met: batch.emerged_at !== null },
    {
      id: 'leaves',
      label: `${batch.target_true_leaves}+ true leaves`,
      met: batch.true_leaf_count >= batch.target_true_leaves,
    },
    { id: 'roots', label: 'Roots visible below plug', met: batch.roots_visible },
    { id: 'plug', label: 'Plug holds together', met: batch.plug_stable },
    { id: 'health', label: 'Seedlings look healthy', met: batch.healthy },
  ]
}

export function isReadyForTransfer(
  batch: Parameters<typeof getReadinessCriteria>[0],
): boolean {
  return getReadinessCriteria(batch).every((criterion) => criterion.met)
}

export function deriveSeedlingStage(
  batch: Parameters<typeof getReadinessCriteria>[0],
  currentStatus?: SeedlingStage,
): SeedlingStage {
  if (currentStatus === 'transferred' || currentStatus === 'discarded') {
    return currentStatus
  }
  if (isReadyForTransfer(batch)) return 'ready'
  if (batch.true_leaf_count > 0) return 'seedling'
  if (batch.emerged_at !== null) return 'germinated'
  return 'sown'
}

export function getNextSeedlingAction(batch: SeedlingBatch): string {
  if (batch.status === 'transferred') return 'Transferred to NFT'
  if (batch.status === 'discarded') return 'Batch closed'
  if (batch.status === 'ready') return 'Transfer to NFT and confirm root contact'
  if (batch.emerged_at === null) return 'Keep plugs evenly moist; record emergence when visible'

  const unmet = getReadinessCriteria(batch).find((criterion) => !criterion.met)
  if (unmet?.id === 'leaves') return 'Remove dome, provide light, and count true leaves'
  if (unmet?.id === 'roots') return 'Inspect the bottom of each plug for visible roots'
  if (unmet?.id === 'plug') return 'Confirm the plug holds together for transfer'
  if (unmet?.id === 'health') return 'Check leaves, stem, and roots before transfer'
  return 'Review transfer readiness'
}

export function germinationRate(batch: SeedlingBatch): number {
  if (batch.quantity_sown <= 0) return 0
  return Math.min(
    100,
    Math.max(0, Math.round((batch.germinated_count / batch.quantity_sown) * 100)),
  )
}
