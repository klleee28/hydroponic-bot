import { describe, expect, it } from 'vitest'
import type { SeedlingBatch } from '../db/database'
import {
  deriveSeedlingStage,
  germinationRate,
  getBatchDay,
  getCareCriteria,
  getPropagationDefaults,
  getReadinessCriteria,
  suggestedTrueLeaves,
} from './seedlings'

const batch: SeedlingBatch = {
  id: 1,
  crop_id: 1,
  cultivar: '',
  quantity_sown: 20,
  plug_medium: 'Rockwool',
  sown_at: new Date(2026, 7, 1, 9).getTime(),
  emerged_at: new Date(2026, 7, 3, 9).getTime(),
  germinated_count: 18,
  true_leaf_count: 3,
  target_true_leaves: 3,
  roots_visible: true,
  plug_stable: true,
  healthy: true,
  propagation_ph_min: 5.5,
  propagation_ph_max: 6,
  propagation_ec_target: 1,
  propagation_ph: 5.8,
  propagation_ec: 1,
  solution_checked_at: new Date(2026, 7, 3, 10).getTime(),
  plug_evenly_moist: true,
  complete_nutrient_prepared: true,
  dome_removed: true,
  light_provided: true,
  status: 'ready',
  transferred_at: null,
  transferred_count: 0,
  channel_name: '',
  root_contact_confirmed: false,
  notes: '',
  updated_at: new Date(2026, 7, 10).getTime(),
}

describe('seedling guidance', () => {
  it('uses a source-backed lettuce leaf target and a customizable generic default', () => {
    expect(suggestedTrueLeaves('Butterhead Lettuce')).toBe(3)
    expect(suggestedTrueLeaves('Basil')).toBe(2)
  })

  it('provides source-backed lettuce propagation targets without guessing for other crops', () => {
    expect(getPropagationDefaults('Butterhead Lettuce')).toMatchObject({
      phMin: 5.5,
      phMax: 6,
      ecTarget: 1,
      temperatureC: 20,
      minimumHumidity: 88,
    })
    expect(getPropagationDefaults('Basil')).toMatchObject({
      phMin: null,
      phMax: null,
      ecTarget: null,
    })
  })

  it('evaluates germination care separately from transfer readiness', () => {
    expect(getCareCriteria(batch).every((item) => item.met)).toBe(true)
    expect(getCareCriteria({ ...batch, propagation_ec: 0.95 }))
      .toContainEqual(expect.objectContaining({ id: 'ec', met: true }))
    expect(getCareCriteria({ ...batch, propagation_ec: 0.9 }))
      .toContainEqual(expect.objectContaining({ id: 'ec', met: false }))
  })

  it('requires every observable criterion before marking a batch ready', () => {
    expect(getReadinessCriteria(batch).every((item) => item.met)).toBe(true)
    expect(deriveSeedlingStage(batch, 'seedling')).toBe('ready')
    expect(deriveSeedlingStage({ ...batch, roots_visible: false }, 'ready')).toBe('seedling')
  })

  it('calculates calendar age and germination rate without prediction', () => {
    expect(getBatchDay(batch.sown_at, new Date(2026, 7, 12, 18))).toBe(11)
    expect(germinationRate(batch)).toBe(90)
  })
})
