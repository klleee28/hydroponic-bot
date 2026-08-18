import { describe, expect, it } from 'vitest'
import {
  evaluateThreshold,
  getOverallStatus,
  getSharedCropThresholds,
} from './thresholds'

describe('evaluateThreshold', () => {
  it('marks the middle of the user range as optimal', () => {
    expect(evaluateThreshold(6.1, 5.8, 6.4)).toEqual({
      status: 'optimal',
      label: 'Optimal',
    })
  })

  it('marks the inner ten-percent boundary bands as near limit', () => {
    expect(evaluateThreshold(5.85, 5.8, 6.4).status).toBe('near-limit')
    expect(evaluateThreshold(6.35, 5.8, 6.4).status).toBe('near-limit')
  })

  it('marks values outside the user range as out of range', () => {
    expect(evaluateThreshold(5.79, 5.8, 6.4).status).toBe('out-of-range')
    expect(evaluateThreshold(6.41, 5.8, 6.4).status).toBe('out-of-range')
  })

  it('rejects a malformed range deterministically', () => {
    expect(evaluateThreshold(6, 6.4, 5.8).status).toBe('out-of-range')
  })
})

describe('getOverallStatus', () => {
  it('uses the most severe current reading', () => {
    expect(getOverallStatus(['optimal', 'near-limit'])).toBe('near-limit')
    expect(getOverallStatus(['near-limit', 'out-of-range'])).toBe(
      'out-of-range',
    )
  })
})

describe('getSharedCropThresholds', () => {
  it('uses the strictest overlapping bounds across reservoir crops', () => {
    expect(
      getSharedCropThresholds([
        {
          target_ph_min: 5.8,
          target_ph_max: 6.4,
          target_ec_min: 1.2,
          target_ec_max: 1.6,
        },
        {
          target_ph_min: 5.5,
          target_ph_max: 6.5,
          target_ec_min: 1,
          target_ec_max: 1.8,
        },
      ]),
    ).toEqual({
      ph: { minimum: 5.8, maximum: 6.4, compatible: true },
      ec: { minimum: 1.2, maximum: 1.6, compatible: true },
      compatible: true,
    })
  })

  it('reports crop combinations with no shared range', () => {
    const thresholds = getSharedCropThresholds([
      {
        target_ph_min: 5.5,
        target_ph_max: 6,
        target_ec_min: 1,
        target_ec_max: 1.4,
      },
      {
        target_ph_min: 6.2,
        target_ph_max: 6.8,
        target_ec_min: 1.6,
        target_ec_max: 2,
      },
    ])

    expect(thresholds?.compatible).toBe(false)
    expect(thresholds?.ph.compatible).toBe(false)
    expect(thresholds?.ec.compatible).toBe(false)
  })
})
