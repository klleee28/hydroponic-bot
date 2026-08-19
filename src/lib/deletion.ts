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
  await db.transaction('rw', [db.crops, db.seedling_batches], async () => {
    const blocker = await getCropDeletionBlocker(cropId)
    if (blocker === 'last-crop') {
      throw new Error('Keep at least one crop in the app.')
    }
    if (blocker === 'seedling-batches') {
      throw new Error('Delete this crop’s seedling batches first.')
    }
    await db.crops.delete(cropId)
  })
}

export async function deleteSeedlingBatch(batchId: number): Promise<void> {
  await db.seedling_batches.delete(batchId)
}
