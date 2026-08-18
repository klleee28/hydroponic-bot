const ACTIVE_CROP_KEY = 'hydroponic.activeCropId.v1'

export function getActiveCropId(): number | null {
  if (typeof window === 'undefined') return null

  const stored = window.localStorage.getItem(ACTIVE_CROP_KEY)
  if (!stored) return null

  const parsed = Number(stored)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

export function setActiveCropId(id: number): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ACTIVE_CROP_KEY, String(id))
}
