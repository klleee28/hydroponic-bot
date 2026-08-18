import { describe, expect, it } from 'vitest'
import { CROP_LIBRARY, CROP_LIBRARY_SOURCE } from './cropLibrary'

describe('offline crop library', () => {
  it('contains unique, alphabetized crop presets with usable ranges', () => {
    const names = CROP_LIBRARY.map((crop) => crop.name)
    expect(new Set(names).size).toBe(names.length)
    expect(names).toEqual([...names].sort((first, second) =>
      first.localeCompare(second),
    ))

    for (const crop of CROP_LIBRARY) {
      expect(crop.target_ph_min).toBeLessThan(crop.target_ph_max)
      expect(crop.target_ec_min).toBeLessThan(crop.target_ec_max)
    }
  })

  it('keeps the published lettuce and basil values locally available', () => {
    expect(CROP_LIBRARY.find((crop) => crop.name === 'Lettuce')).toMatchObject({
      target_ph_min: 6,
      target_ph_max: 7,
      target_ec_min: 1.2,
      target_ec_max: 1.8,
    })
    expect(CROP_LIBRARY.find((crop) => crop.name === 'Basil')).toMatchObject({
      target_ph_min: 5.5,
      target_ph_max: 6,
      target_ec_min: 1,
      target_ec_max: 1.6,
    })
    expect(CROP_LIBRARY_SOURCE.url).toContain('okstate.edu')
  })
})
