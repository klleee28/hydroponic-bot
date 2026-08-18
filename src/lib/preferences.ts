const ACTIVE_CROP_KEY = 'hydroponic.activeCropId.v1'
const RESERVOIR_CROPS_KEY = 'hydroponic.reservoirCropIds.v1'

export function getActiveCropId(): number | null {
  if (typeof window === 'undefined') return null

  const stored = window.localStorage.getItem(ACTIVE_CROP_KEY)
  if (!stored) return null

  const parsed = Number(stored)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

export function getReservoirCropIds(): number[] {
  if (typeof window === 'undefined') return []

  const stored = window.localStorage.getItem(RESERVOIR_CROPS_KEY)
  if (!stored) return []

  try {
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed)) return []

    return [...new Set(parsed)].filter(
      (id): id is number => Number.isInteger(id) && Number(id) > 0,
    )
  } catch {
    return []
  }
}

export function setReservoirCropIds(ids: number[]): void {
  if (typeof window === 'undefined') return
  const normalized = [...new Set(ids)].filter(
    (id) => Number.isInteger(id) && id > 0,
  )
  window.localStorage.setItem(RESERVOIR_CROPS_KEY, JSON.stringify(normalized))
}
