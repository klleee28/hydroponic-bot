import { db, type GrowAreaType, type GrowPosition } from '../db/database'

export interface CreateGrowAreaInput {
  name: string
  type: GrowAreaType
  rows: number
  columns: number
}

export interface LayoutAssignment {
  positionId: number
  cropId?: number
  seedlingBatchId?: number
}

function normalizedDimension(value: number): number {
  return Math.min(24, Math.max(1, Math.round(value)))
}

function positionCode(type: GrowAreaType, row: number, column: number): string {
  if (type === 'nft-channel') return String(column + 1).padStart(2, '0')
  return `${String.fromCharCode(65 + row)}${column + 1}`
}

function ensureOneAssignedItem(input: LayoutAssignment): void {
  if (Boolean(input.cropId) === Boolean(input.seedlingBatchId)) {
    throw new Error('Choose one crop or one seedling batch for this position.')
  }
}

export async function createGrowArea(input: CreateGrowAreaInput): Promise<number> {
  const name = input.name.trim()
  if (!name) throw new Error('Give this layout a name.')

  const rows = input.type === 'nft-channel' ? 1 : normalizedDimension(input.rows)
  const columns = normalizedDimension(input.columns)
  const now = Date.now()

  return db.transaction('rw', [db.grow_areas, db.grow_positions], async () => {
    const areaId = await db.grow_areas.add({
      name,
      type: input.type,
      rows,
      columns,
      created_at: now,
      updated_at: now,
    })
    const positions: Omit<GrowPosition, 'id'>[] = []
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        positions.push({
          area_id: areaId,
          row,
          column,
          position_code: positionCode(input.type, row, column),
          crop_id: null,
          seedling_batch_id: null,
          assigned_at: null,
          updated_at: now,
        })
      }
    }
    await db.grow_positions.bulkAdd(positions)
    return areaId
  })
}

export async function assignGrowPosition(input: LayoutAssignment): Promise<void> {
  ensureOneAssignedItem(input)
  await db.transaction(
    'rw',
    [db.grow_positions, db.grow_areas, db.crops, db.seedling_batches, db.layout_activity],
    async () => {
      const [position, crop, batch] = await Promise.all([
        db.grow_positions.get(input.positionId),
        input.cropId ? db.crops.get(input.cropId) : undefined,
        input.seedlingBatchId ? db.seedling_batches.get(input.seedlingBatchId) : undefined,
      ])
      if (!position) throw new Error('This position no longer exists.')
      if (input.cropId && !crop) throw new Error('This crop no longer exists.')
      if (input.seedlingBatchId && !batch) throw new Error('This seedling batch no longer exists.')
      const area = await db.grow_areas.get(position.area_id)
      if (!area) throw new Error('This layout no longer exists.')
      const now = Date.now()
      const itemLabel = crop?.name ?? `Seedling batch${batch?.cultivar ? ` · ${batch.cultivar}` : ''}`
      await db.grow_positions.update(position.id, {
        crop_id: input.cropId ?? null,
        seedling_batch_id: input.seedlingBatchId ?? null,
        assigned_at: now,
        updated_at: now,
      })
      await db.grow_areas.update(area.id, { updated_at: now })
      await db.layout_activity.add({
        action: 'assigned',
        area_id: area.id,
        area_name: area.name,
        position_id: position.id,
        position_code: position.position_code,
        crop_id: input.cropId ?? null,
        seedling_batch_id: input.seedlingBatchId ?? null,
        item_label: itemLabel,
        timestamp: now,
      })
    },
  )
}

export async function clearGrowPosition(positionId: number): Promise<void> {
  await db.transaction('rw', [db.grow_positions, db.grow_areas, db.layout_activity], async () => {
    const position = await db.grow_positions.get(positionId)
    if (!position) throw new Error('This position no longer exists.')
    if (position.crop_id === null && position.seedling_batch_id === null) return
    const area = await db.grow_areas.get(position.area_id)
    if (!area) throw new Error('This layout no longer exists.')
    const prior = await db.layout_activity
      .where('position_id')
      .equals(position.id)
      .reverse()
      .first()
    const now = Date.now()
    await db.grow_positions.update(position.id, {
      crop_id: null,
      seedling_batch_id: null,
      assigned_at: null,
      updated_at: now,
    })
    await db.grow_areas.update(area.id, { updated_at: now })
    await db.layout_activity.add({
      action: 'cleared',
      area_id: area.id,
      area_name: area.name,
      position_id: position.id,
      position_code: position.position_code,
      crop_id: position.crop_id,
      seedling_batch_id: position.seedling_batch_id,
      item_label: prior?.item_label ?? 'Recorded item',
      timestamp: now,
    })
  })
}

export async function deleteGrowArea(areaId: number): Promise<void> {
  await db.transaction('rw', [db.grow_areas, db.grow_positions], async () => {
    await db.grow_positions.where('area_id').equals(areaId).delete()
    await db.grow_areas.delete(areaId)
  })
}

export function isPositionOccupied(position: GrowPosition): boolean {
  return position.crop_id !== null || position.seedling_batch_id !== null
}

/** Full calendar days since an item was recorded in a layout position. */
export function elapsedDays(assignedAt: number | null, now: number = Date.now()): number | null {
  if (assignedAt === null) return null
  return Math.max(0, Math.floor((now - assignedAt) / 86_400_000))
}

export function areaTypeLabel(type: GrowAreaType): string {
  if (type === 'nft-channel') return 'NFT channel'
  if (type === 'seedling-tray') return 'Seedling tray'
  return 'Grow grid'
}
