import { describe, expect, it } from 'vitest'
import { parseDecimalInput, validateCropInput } from './cropValidation'

describe('cropValidation', () => {
  describe('parseDecimalInput', () => {
    it('parses standard decimal strings', () => {
      expect(parseDecimalInput('5.8')).toBe(5.8)
      expect(parseDecimalInput('1.25')).toBe(1.25)
    })

    it('parses comma decimal strings', () => {
      expect(parseDecimalInput('5,8')).toBe(5.8)
      expect(parseDecimalInput('1,25')).toBe(1.25)
    })

    it('trims whitespace', () => {
      expect(parseDecimalInput('  6.4  ')).toBe(6.4)
    })

    it('returns NaN for invalid numeric strings', () => {
      expect(Number.isNaN(parseDecimalInput('abc'))).toBe(true)
    })
  })

  describe('validateCropInput', () => {
    it('validates and parses valid decimal string crop inputs', () => {
      const result = validateCropInput({
        name: 'Tomato',
        target_ph_min: '5.8',
        target_ph_max: '6.4',
        target_ec_min: '2.0',
        target_ec_max: '5.0',
      })

      expect(result.valid).toBe(true)
      expect(result.crop).toEqual({
        name: 'Tomato',
        target_ph_min: 5.8,
        target_ph_max: 6.4,
        target_ec_min: 2.0,
        target_ec_max: 5.0,
      })
    })

    it('supports comma decimals from regional keypads', () => {
      const result = validateCropInput({
        name: 'Basil',
        target_ph_min: '5,5',
        target_ph_max: '6,5',
        target_ec_min: '1,0',
        target_ec_max: '1,6',
      })

      expect(result.valid).toBe(true)
      expect(result.crop).toEqual({
        name: 'Basil',
        target_ph_min: 5.5,
        target_ph_max: 6.5,
        target_ec_min: 1.0,
        target_ec_max: 1.6,
      })
    })

    it('rejects empty crop name', () => {
      const result = validateCropInput({
        name: '   ',
        target_ph_min: '5.8',
        target_ph_max: '6.4',
        target_ec_min: '1.2',
        target_ec_max: '1.6',
      })

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Enter a crop name.')
    })

    it('rejects invalid numbers', () => {
      const result = validateCropInput({
        name: 'Lettuce',
        target_ph_min: '5.8',
        target_ph_max: 'abc',
        target_ec_min: '1.2',
        target_ec_max: '1.6',
      })

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Enter valid numeric values for pH and EC targets.')
    })

    it('rejects pH min >= pH max', () => {
      const result = validateCropInput({
        name: 'Kale',
        target_ph_min: '6.5',
        target_ph_max: '5.5',
        target_ec_min: '1.2',
        target_ec_max: '1.6',
      })

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Minimum pH must be less than Maximum pH, between 0 and 14.')
    })

    it('rejects EC min >= EC max', () => {
      const result = validateCropInput({
        name: 'Pepper',
        target_ph_min: '5.8',
        target_ph_max: '6.4',
        target_ec_min: '2.5',
        target_ec_max: '2.0',
      })

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Minimum EC must be non-negative and less than Maximum EC.')
    })

    it('rejects out-of-range pH (<0 or >14)', () => {
      const result = validateCropInput({
        name: 'Spinach',
        target_ph_min: '-1.0',
        target_ph_max: '6.0',
        target_ec_min: '1.2',
        target_ec_max: '1.6',
      })

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Minimum pH must be less than Maximum pH, between 0 and 14.')
    })
  })
})
