import type { Crop } from '../db/database'

export type CropPreset = Omit<Crop, 'id'>

export const CROP_LIBRARY_SOURCE = {
  title: 'Oklahoma State University Extension HLA-6722',
  url: 'https://extension.okstate.edu/fact-sheets/electrical-conductivity-and-ph-guide-for-hydroponics',
} as const

// Static, offline presets transcribed from Table 2 of HLA-6722. Crops with
// point targets rather than ranges are omitted because this app evaluates a
// user-visible minimum and maximum range.
export const CROP_LIBRARY: CropPreset[] = [
  {
    name: 'Asparagus',
    target_ph_min: 6,
    target_ph_max: 6.8,
    target_ec_min: 1.4,
    target_ec_max: 1.8,
  },
  {
    name: 'Basil',
    target_ph_min: 5.5,
    target_ph_max: 6,
    target_ec_min: 1,
    target_ec_max: 1.6,
  },
  {
    name: 'Broccoli',
    target_ph_min: 6,
    target_ph_max: 6.8,
    target_ec_min: 2.8,
    target_ec_max: 3.5,
  },
  {
    name: 'Cabbage',
    target_ph_min: 6.5,
    target_ph_max: 7,
    target_ec_min: 2.5,
    target_ec_max: 3,
  },
  {
    name: 'Cucumber',
    target_ph_min: 5,
    target_ph_max: 5.5,
    target_ec_min: 1.7,
    target_ec_max: 2,
  },
  {
    name: 'Leek',
    target_ph_min: 6.5,
    target_ph_max: 7,
    target_ec_min: 1.4,
    target_ec_max: 1.8,
  },
  {
    name: 'Lettuce',
    target_ph_min: 6,
    target_ph_max: 7,
    target_ec_min: 1.2,
    target_ec_max: 1.8,
  },
  {
    name: 'Parsley',
    target_ph_min: 6,
    target_ph_max: 6.5,
    target_ec_min: 1.8,
    target_ec_max: 2.2,
  },
  {
    name: 'Peppers',
    target_ph_min: 5.5,
    target_ph_max: 6,
    target_ec_min: 0.8,
    target_ec_max: 1.8,
  },
  {
    name: 'Rhubarb',
    target_ph_min: 5.5,
    target_ph_max: 6,
    target_ec_min: 1.6,
    target_ec_max: 2,
  },
  {
    name: 'Sage',
    target_ph_min: 5.5,
    target_ph_max: 6.5,
    target_ec_min: 1,
    target_ec_max: 1.6,
  },
  {
    name: 'Spinach',
    target_ph_min: 6,
    target_ph_max: 7,
    target_ec_min: 1.8,
    target_ec_max: 2.3,
  },
  {
    name: 'Tomato',
    target_ph_min: 6,
    target_ph_max: 6.5,
    target_ec_min: 2,
    target_ec_max: 4,
  },
]

export function cropsMatchPreset(crop: Crop, preset: CropPreset): boolean {
  return (crop.name === preset.name || crop.name === `${preset.name} (OSU preset)`)
    && crop.target_ph_min === preset.target_ph_min
    && crop.target_ph_max === preset.target_ph_max
    && crop.target_ec_min === preset.target_ec_min
    && crop.target_ec_max === preset.target_ec_max
}
