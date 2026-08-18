import { db } from './database'
import {
  getActiveCropId,
  getReservoirCropIds,
  setReservoirCropIds,
} from '../lib/preferences'
import { CROP_LIBRARY } from '../lib/cropLibrary'

const DEFAULT_CROP_NAMES = new Set(['Lettuce'])
const DEFAULT_CROPS = CROP_LIBRARY.filter((crop) =>
  DEFAULT_CROP_NAMES.has(crop.name),
).map((crop) => ({ ...crop }))

const DEFAULT_TASKS = [
  {
    title: 'Flush Reservoir',
    interval_days: 14,
    last_completed_date: null,
  },
  {
    title: 'Clean Pump Filter',
    interval_days: 7,
    last_completed_date: null,
  },
]

export async function initializeDatabase(): Promise<number[]> {
  await db.transaction('rw', [db.crops, db.tasks], async () => {
    if ((await db.crops.count()) === 0) {
      await db.crops.bulkAdd(DEFAULT_CROPS)
    }

    if ((await db.tasks.count()) === 0) {
      await db.tasks.bulkAdd(DEFAULT_TASKS)
    }
  })

  const crops = await db.crops.orderBy('id').toArray()
  if (!crops.length) {
    throw new Error('Unable to initialize reservoir crops')
  }

  const availableIds = new Set(crops.map((crop) => crop.id))
  const savedIds = getReservoirCropIds().filter((id) => availableIds.has(id))
  if (savedIds.length) {
    setReservoirCropIds(savedIds)
    return savedIds
  }

  // Preserve an existing user's former active crop without silently widening
  // its thresholds. Brand-new installs include all seeded reservoir crops.
  const legacyId = getActiveCropId()
  const selectedIds = legacyId && availableIds.has(legacyId)
    ? [legacyId]
    : crops.map((crop) => crop.id)

  setReservoirCropIds(selectedIds)
  return selectedIds
}
