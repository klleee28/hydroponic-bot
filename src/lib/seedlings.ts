import type { SeedlingBatch, SeedlingStage } from '../db/database'
import { parseLocalDate, toLocalDateString } from './dates'

const DAY_MS = 86_400_000
export const PROPAGATION_EC_TOLERANCE = 0.05

export interface ReadinessCriterion {
  id: 'emerged' | 'leaves' | 'roots' | 'plug' | 'health'
  label: string
  met: boolean
}

export interface PropagationDefaults {
  phMin: number | null
  phMax: number | null
  ecTarget: number | null
  temperatureC: number | null
  minimumHumidity: number | null
  sourceTitle: string | null
  sourceUrl: string | null
}

export interface CareCriterion {
  id: 'moisture' | 'nutrient' | 'ph' | 'ec' | 'dome' | 'light'
  label: string
  met: boolean
}

const LETTUCE_PROPAGATION_SOURCE = {
  title: 'University of Kentucky hydroponic lettuce guide',
  url: 'https://ccd.uky.edu/sites/default/files/2026-02/ccd-cp-63_hydrolettuce-updated_accessible.pdf',
} as const

export function getPropagationDefaults(cropName: string): PropagationDefaults {
  if (cropName.toLocaleLowerCase().includes('lettuce')) {
    return {
      phMin: 5.5,
      phMax: 6,
      ecTarget: 1,
      temperatureC: 20,
      minimumHumidity: 88,
      sourceTitle: LETTUCE_PROPAGATION_SOURCE.title,
      sourceUrl: LETTUCE_PROPAGATION_SOURCE.url,
    }
  }

  return {
    phMin: null,
    phMax: null,
    ecTarget: null,
    temperatureC: null,
    minimumHumidity: null,
    sourceTitle: null,
    sourceUrl: null,
  }
}

export function getCareCriteria(
  batch: Pick<
    SeedlingBatch,
    | 'emerged_at'
    | 'propagation_ph_min'
    | 'propagation_ph_max'
    | 'propagation_ec_target'
    | 'propagation_ph'
    | 'propagation_ec'
    | 'plug_evenly_moist'
    | 'complete_nutrient_prepared'
    | 'dome_removed'
    | 'light_provided'
  >,
): CareCriterion[] {
  const phTargetSet = batch.propagation_ph_min !== null
    && batch.propagation_ph_max !== null
    && batch.propagation_ph_min < batch.propagation_ph_max
  const phInRange = phTargetSet
    && batch.propagation_ph !== null
    && batch.propagation_ph >= batch.propagation_ph_min!
    && batch.propagation_ph <= batch.propagation_ph_max!
  const ecTargetSet = batch.propagation_ec_target !== null
    && batch.propagation_ec_target >= 0
  const ecAtTarget = ecTargetSet
    && batch.propagation_ec !== null
    && Math.abs(batch.propagation_ec - batch.propagation_ec_target!)
      <= PROPAGATION_EC_TOLERANCE + Number.EPSILON

  const criteria: CareCriterion[] = [
    {
      id: 'moisture',
      label: 'Plugs evenly moist, not flooded',
      met: batch.plug_evenly_moist,
    },
    {
      id: 'nutrient',
      label: 'Mild complete nutrient ready for seedling stage',
      met: batch.complete_nutrient_prepared,
    },
    {
      id: 'ph',
      label: phTargetSet
        ? `pH ${batch.propagation_ph_min!.toFixed(1)}–${batch.propagation_ph_max!.toFixed(1)}`
        : 'Custom pH target added',
      met: phInRange,
    },
    {
      id: 'ec',
      label: ecTargetSet
        ? `EC ${batch.propagation_ec_target!.toFixed(2)} ±0.05 mS/cm`
        : 'Custom EC target added',
      met: ecAtTarget,
    },
  ]

  if (batch.emerged_at !== null) {
    criteria.push(
      {
        id: 'dome',
        label: 'Humidity dome removed or not used',
        met: batch.dome_removed,
      },
      {
        id: 'light',
        label: 'Seedling light provided',
        met: batch.light_provided,
      },
    )
  }

  return criteria
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

  const unmetCare = getCareCriteria(batch).find((criterion) => !criterion.met)
  if (unmetCare?.id === 'moisture') return 'Confirm plugs are evenly moist, not flooded'
  if (unmetCare?.id === 'nutrient') return 'Prepare mild complete nutrient for the seedling stage'
  if (unmetCare?.id === 'ph' || unmetCare?.id === 'ec') {
    return 'Measure and adjust the propagation solution pH and EC'
  }
  if (unmetCare?.id === 'dome') return 'Remove the humidity dome after emergence'
  if (unmetCare?.id === 'light') return 'Provide seedling light after emergence'
  if (batch.emerged_at === null) return 'Record emergence when seedlings are visible'

  const unmet = getReadinessCriteria(batch).find((criterion) => !criterion.met)
  if (unmet?.id === 'leaves') return `Count true leaves; ${batch.target_true_leaves} required for transfer`
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
