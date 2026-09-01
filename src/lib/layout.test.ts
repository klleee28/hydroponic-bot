import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/database'
import { assignGrowPosition, clearGrowPosition, createGrowArea } from './layout'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('grow layout', () => {
  it('creates a numbered NFT channel with empty positions', async () => {
    const areaId = await createGrowArea({
      name: 'NFT A', type: 'nft-channel', rows: 8, columns: 4,
    })
    const positions = await db.grow_positions.where('area_id').equals(areaId).toArray()
    expect(positions.map((position) => position.position_code)).toEqual(['01', '02', '03', '04'])
    expect(positions.every((position) => position.crop_id === null)).toBe(true)
  })

  it('records the assigned item and a clear activity', async () => {
    const cropId = await db.crops.add({
      name: 'Lettuce', target_ph_min: 5.8, target_ph_max: 6.4, target_ec_min: 1.2, target_ec_max: 1.8,
    })
    const areaId = await createGrowArea({ name: 'Tray A', type: 'seedling-tray', rows: 2, columns: 2 })
    const position = await db.grow_positions.where('area_id').equals(areaId).first()
    if (!position) throw new Error('Expected a grow position')
    await assignGrowPosition({ positionId: position.id, cropId })
    await clearGrowPosition(position.id)
    const updated = await db.grow_positions.get(position.id)
    const activity = await db.layout_activity.orderBy('timestamp').toArray()
    expect(updated?.crop_id).toBeNull()
    expect(activity.map((item) => [item.action, item.item_label])).toEqual([
      ['assigned', 'Lettuce'], ['cleared', 'Lettuce'],
    ])
  })

  it('requires one current item when assigning a position', async () => {
    const areaId = await createGrowArea({ name: 'Tray A', type: 'seedling-tray', rows: 1, columns: 1 })
    const position = await db.grow_positions.where('area_id').equals(areaId).first()
    if (!position) throw new Error('Expected a grow position')
    await expect(assignGrowPosition({ positionId: position.id })).rejects.toThrow('Choose one crop')
  })
})
