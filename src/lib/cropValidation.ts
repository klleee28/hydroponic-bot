export interface CropFormInput {
  name: string
  target_ph_min: string
  target_ph_max: string
  target_ec_min: string
  target_ec_max: string
}

export interface ValidatedCrop {
  name: string
  target_ph_min: number
  target_ph_max: number
  target_ec_min: number
  target_ec_max: number
}

export interface CropValidationResult {
  valid: boolean
  crop?: ValidatedCrop
  error?: string
}

export function parseDecimalInput(value: string): number {
  const normalized = value.trim().replace(',', '.')
  return Number(normalized)
}

export function validateCropInput(input: CropFormInput): CropValidationResult {
  const name = input.name.trim()
  if (!name) {
    return { valid: false, error: 'Enter a crop name.' }
  }

  const phMin = parseDecimalInput(input.target_ph_min)
  const phMax = parseDecimalInput(input.target_ph_max)
  const ecMin = parseDecimalInput(input.target_ec_min)
  const ecMax = parseDecimalInput(input.target_ec_max)

  if (
    !Number.isFinite(phMin) ||
    !Number.isFinite(phMax) ||
    !Number.isFinite(ecMin) ||
    !Number.isFinite(ecMax)
  ) {
    return { valid: false, error: 'Enter valid numeric values for pH and EC targets.' }
  }

  if (phMin < 0 || phMax > 14 || phMin >= phMax) {
    return { valid: false, error: 'Minimum pH must be less than Maximum pH, between 0 and 14.' }
  }

  if (ecMin < 0 || ecMax < 0 || ecMin >= ecMax) {
    return { valid: false, error: 'Minimum EC must be non-negative and less than Maximum EC.' }
  }

  return {
    valid: true,
    crop: {
      name,
      target_ph_min: phMin,
      target_ph_max: phMax,
      target_ec_min: ecMin,
      target_ec_max: ecMax,
    },
  }
}
