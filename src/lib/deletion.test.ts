import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, type Crop, type SeedlingBatch } from '../db/database'
import {
  deleteCrop,
  deleteSeedlingBatch,
  getCropDeletionBlocker,
} from './deletion'

const lettuce: Crop = {
  id: 1,
  name: 'Lettuce',
  target_ph_min: 5.5,
  target_ph_max: 6,
  target_ec_min: 1.2,
  target_ec_max: 1.8,
}

const basil: Crop = {
  ...lettuce,
  id: 2,
  name: 'Basil',
}

const batch: SeedlingBatch = {
  id: 1,
  crop_id: lettuce.id,
  cultivar: '',
  quantity_sown: 12,
  plug_medium: 'Rockwool',
  sown_at: Date.now(),
  emerged_at: null,
  germinated_count: 0,
  true_leaf_count: 0,
  target_true_leaves: 3,
  roots_visible: false,
  plug_stable: false,
  healthy: false,
  propagation_ph_min: 5.5,
  propagation_ph_max: 6,
  propagation_ec_target: 1,
  propagation_ph: null,
  propagation_ec: null,
  solution_checked_at: null,
  plug_evenly_moist: false,
  complete_nutrient_prepared: false,
  dome_removed: false,
  light_provided: false,
  status: 'sown',
  transferred_at: null,
  transferred_count: 0,
  channel_name: '',
  root_contact_confirmed: false,
  notes: '',
  updated_at: Date.now(),
}

describe('local record deletion', () => {
  beforeEach(async () => {
    await db.transaction('rw', [db.crops, db.seedling_batches], async () => {
      await Promise.all([db.crops.clear(), db.seedling_batches.clear()])
    })
  })

  it('keeps at least one crop', async () => {
    await db.crops.add(lettuce)
    expect(await getCropDeletionBlocker(lettuce.id)).toBe('last-crop')
    await expect(deleteCrop(lettuce.id)).rejects.toThrow('at least one crop')
  })

  it('protects crop history until its seedling batches are removed', async () => {
    await db.crops.bulkAdd([lettuce, basil])
    await db.seedling_batches.add(batch)

    expect(await getCropDeletionBlocker(lettuce.id)).toBe('seedling-batches')
    await expect(deleteCrop(lettuce.id)).rejects.toThrow('seedling batches first')
    expect(await db.crops.get(lettuce.id)).toEqual(lettuce)
  })

  it('permanently deletes a batch and then permits its crop to be deleted', async () => {
    await db.crops.bulkAdd([lettuce, basil])
    await db.seedling_batches.add(batch)

    await deleteSeedlingBatch(batch.id)
    await deleteCrop(lettuce.id)

    expect(await db.seedling_batches.get(batch.id)).toBeUndefined()
    expect(await db.crops.get(lettuce.id)).toBeUndefined()
    expect(await db.crops.get(basil.id)).toEqual(basil)
  })
})
