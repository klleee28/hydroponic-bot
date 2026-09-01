import { db } from '../db/database'

export type CropDeletionBlocker = 'last-crop' | 'seedling-batches' | null

export async function getCropDeletionBlocker(
  cropId: number,
): Promise<CropDeletionBlocker> {
  const [cropCount, seedlingCount] = await Promise.all([
    db.crops.count(),
    db.seedling_batches.where('crop_id').equals(cropId).count(),
  ])
  if (cropCount <= 1) return 'last-crop'
  if (seedlingCount > 0) return 'seedling-batches'
  return null
}

export async function deleteCrop(cropId: number): Promise<void> {
  await db.transaction(
    'rw',
    [db.crops, db.seedling_batches, db.grow_positions, db.grow_areas, db.layout_activity],
    async () => {
    const blocker = await getCropDeletionBlocker(cropId)
    if (blocker === 'last-crop') {
      throw new Error('Keep at least one crop in the app.')
    }
    if (blocker === 'seedling-batches') {
      throw new Error('Delete this crop’s seedling batches first.')
    }
    const [crop, positions] = await Promise.all([
      db.crops.get(cropId),
      db.grow_positions.where('crop_id').equals(cropId).toArray(),
    ])
    const now = Date.now()
    const areas = new Map((await db.grow_areas.bulkGet(positions.map((position) => position.area_id)))
      .filter((area): area is NonNullable<typeof area> => area !== undefined)
      .map((area) => [area.id, area]))
    await Promise.all(positions.flatMap((position) => {
      const area = areas.get(position.area_id)
      if (!area) return []
      return [
        db.grow_positions.update(position.id, {
          crop_id: null,
          assigned_at: null,
          updated_at: now,
        }),
        db.grow_areas.update(area.id, { updated_at: now }),
        db.layout_activity.add({
          action: 'cleared',
          area_id: area.id,
          area_name: area.name,
          position_id: position.id,
          position_code: position.position_code,
          crop_id: cropId,
          seedling_batch_id: null,
          item_label: crop?.name ?? 'Deleted crop',
          timestamp: now,
        }),
      ]
    }))
    await db.crops.delete(cropId)
    },
  )
}

export async function deleteSeedlingBatch(batchId: number): Promise<void> {
  await db.transaction(
    'rw',
    [db.seedling_batches, db.crops, db.grow_positions, db.grow_areas, db.layout_activity],
    async () => {
      const [batch, positions] = await Promise.all([
        db.seedling_batches.get(batchId),
        db.grow_positions.where('seedling_batch_id').equals(batchId).toArray(),
      ])
      if (!batch) return
      const [crop, areas] = await Promise.all([
        db.crops.get(batch.crop_id),
        db.grow_areas.bulkGet(positions.map((position) => position.area_id)),
      ])
      const areaMap = new Map(areas
        .filter((area): area is NonNullable<typeof area> => area !== undefined)
        .map((area) => [area.id, area]))
      const now = Date.now()
      const label = `${crop?.name ?? 'Deleted crop'} seedling batch${batch.cultivar ? ` · ${batch.cultivar}` : ''}`
      await Promise.all(positions.flatMap((position) => {
        const area = areaMap.get(position.area_id)
        if (!area) return []
        return [
          db.grow_positions.update(position.id, {
            seedling_batch_id: null,
            assigned_at: null,
            updated_at: now,
          }),
          db.grow_areas.update(area.id, { updated_at: now }),
          db.layout_activity.add({
            action: 'cleared',
            area_id: area.id,
            area_name: area.name,
            position_id: position.id,
            position_code: position.position_code,
            crop_id: null,
            seedling_batch_id: batchId,
            item_label: label,
            timestamp: now,
          }),
        ]
      }))
      await db.seedling_batches.delete(batchId)
    },
  )
}
