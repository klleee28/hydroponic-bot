import { describe, expect, it } from 'vitest'
import { evaluateThreshold, getOverallStatus } from './thresholds'

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
