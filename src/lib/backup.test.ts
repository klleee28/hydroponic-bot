import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  db,
  type Crop,
  type MaintenanceTask,
  type ReservoirLog,
  type SeedlingBatch,
  type GrowArea,
  type GrowPosition,
  type LayoutActivity,
} from '../db/database'
import {
  backupFileName,
  createLogsCsv,
  createReservoirBackup,
  logsCsvFileName,
  parseReservoirBackup,
  restoreReservoirBackup,
  type ReservoirBackup,
} from './backup'

const crop: Crop = {
  id: 7,
  name: 'Test Lettuce',
  target_ph_min: 5.8,
  target_ph_max: 6.4,
  target_ec_min: 1.2,
  target_ec_max: 1.8,
}

const log: ReservoirLog = {
  id: 9,
  timestamp: new Date(2026, 7, 18, 8, 30).getTime(),
  updated_at: new Date(2026, 7, 18, 8, 35).getTime(),
  ph: 6.1,
  ec: 1.4,
  water_temp: 21,
  water_added_liters: 0.5,
  notes: 'Adjusted, checked "roots"',
}

const task: MaintenanceTask = {
  id: 11,
  title: 'Flush Reservoir',
  interval_days: 14,
  last_completed_date: '2026-08-18',
}

const seedlingBatch: SeedlingBatch = {
  id: 13,
  crop_id: crop.id,
  cultivar: 'Butterhead',
  quantity_sown: 12,
  plug_medium: 'Rockwool',
  sown_at: new Date(2026, 7, 18, 7, 30).getTime(),
  emerged_at: null,
  germinated_count: 0,
  true_leaf_count: 0,
  target_true_leaves: 3,
  roots_visible: false,
  plug_stable: false,
  healthy: false,
  propagation_ph_min: 5.5,
  propagation_ph_max: 6,
  propagation_ec_target: 1,
  propagation_ph: null,
  propagation_ec: null,
  solution_checked_at: null,
  plug_evenly_moist: false,
  complete_nutrient_prepared: false,
  dome_removed: false,
  light_provided: false,
  status: 'sown',
  transferred_at: null,
  transferred_count: 0,
  channel_name: '',
  root_contact_confirmed: false,
  notes: '',
  updated_at: new Date(2026, 7, 18, 7, 30).getTime(),
}

const growArea: GrowArea = {
  id: 17,
  name: 'NFT A',
  type: 'nft-channel',
  rows: 1,
  columns: 4,
  created_at: new Date(2026, 7, 18, 7, 30).getTime(),
  updated_at: new Date(2026, 7, 18, 7, 35).getTime(),
}

const growPosition: GrowPosition = {
  id: 19,
  area_id: growArea.id,
  row: 0,
  column: 0,
  position_code: '01',
  crop_id: crop.id,
  seedling_batch_id: null,
  assigned_at: new Date(2026, 7, 18, 7, 40).getTime(),
  updated_at: new Date(2026, 7, 18, 7, 40).getTime(),
}

const layoutActivity: LayoutActivity = {
  id: 23,
  action: 'assigned',
  area_id: growArea.id,
  area_name: growArea.name,
  position_id: growPosition.id,
  position_code: growPosition.position_code,
  crop_id: crop.id,
  seedling_batch_id: null,
  item_label: crop.name,
  timestamp: new Date(2026, 7, 18, 7, 40).getTime(),
}

function validBackup(): ReservoirBackup {
  return {
    format: 'hydroponic-reservoir-backup',
    version: 4,
    exported_at: '2026-08-18T08:00:00.000Z',
    crops: [crop],
    logs: [log],
    tasks: [task],
    seedling_batches: [seedlingBatch],
    grow_areas: [growArea],
    grow_positions: [growPosition],
    layout_activity: [layoutActivity],
    reservoir_crop_ids: [crop.id],
  }
}

describe('reservoir backup', () => {
  beforeEach(async () => {
    await db.transaction('rw', [
      db.crops,
      db.logs,
      db.tasks,
      db.seedling_batches,
      db.grow_areas,
      db.grow_positions,
      db.layout_activity,
    ], async () => {
      await Promise.all([
        db.crops.clear(),
        db.logs.clear(),
        db.tasks.clear(),
        db.seedling_batches.clear(),
        db.grow_areas.clear(),
        db.grow_positions.clear(),
        db.layout_activity.clear(),
      ])
    })
  })

  it('exports every local table and the reservoir crop selection', async () => {
    await Promise.all([
      db.crops.add(crop),
      db.logs.add(log),
      db.tasks.add(task),
      db.seedling_batches.add(seedlingBatch),
      db.grow_areas.add(growArea),
      db.grow_positions.add(growPosition),
      db.layout_activity.add(layoutActivity),
    ])

    const backup = await createReservoirBackup(
      [crop.id],
      new Date('2026-08-18T08:00:00.000Z'),
    )

    expect(backup).toEqual(validBackup())
    expect(parseReservoirBackup(JSON.stringify(backup))).toEqual(backup)
  })

  it('replaces all three tables only after a backup has validated', async () => {
    await db.crops.add({ ...crop, id: 1, name: 'Old crop' })

    expect(await restoreReservoirBackup(validBackup())).toEqual([crop.id])
    expect(await db.crops.toArray()).toEqual([crop])
    expect(await db.logs.toArray()).toEqual([log])
    expect(await db.tasks.toArray()).toEqual([task])
    expect(await db.seedling_batches.toArray()).toEqual([seedlingBatch])
    expect(await db.grow_areas.toArray()).toEqual([growArea])
    expect(await db.grow_positions.toArray()).toEqual([growPosition])
    expect(await db.layout_activity.toArray()).toEqual([layoutActivity])
  })

  it('restores older backups without edit timestamps', async () => {
    const backup = validBackup()
    const legacyLog = { ...backup.logs[0] } as Partial<ReservoirLog>
    delete legacyLog.updated_at
    backup.logs = [legacyLog as ReservoirLog]

    expect(parseReservoirBackup(JSON.stringify(backup)).logs[0].updated_at)
      .toBeUndefined()
    await restoreReservoirBackup(backup)
    expect((await db.logs.get(log.id))?.updated_at).toBe(log.timestamp)
  })

  it('upgrades version 1 backups with an empty seedling collection', () => {
    const backup = validBackup()
    const legacy = { ...backup, version: 1 } as Record<string, unknown>
    delete legacy.seedling_batches

    const parsed = parseReservoirBackup(JSON.stringify(legacy))
    expect(parsed.version).toBe(4)
    expect(parsed.seedling_batches).toEqual([])
    expect(parsed.grow_areas).toEqual([])
  })

  it('upgrades version 2 seedling batches with propagation defaults', () => {
    const backup = validBackup()
    const legacyBatch = { ...backup.seedling_batches[0] } as Record<string, unknown>
    for (const key of [
      'propagation_ph_min',
      'propagation_ph_max',
      'propagation_ec_target',
      'propagation_ph',
      'propagation_ec',
      'solution_checked_at',
      'plug_evenly_moist',
      'complete_nutrient_prepared',
      'dome_removed',
      'light_provided',
    ]) delete legacyBatch[key]
    const legacy = {
      ...backup,
      version: 2,
      seedling_batches: [legacyBatch],
    }

    const parsed = parseReservoirBackup(JSON.stringify(legacy))
    expect(parsed.seedling_batches[0]).toMatchObject({
      propagation_ph_min: 5.5,
      propagation_ph_max: 6,
      propagation_ec_target: 1,
      propagation_ph: null,
      propagation_ec: null,
    })
  })

  it('rejects malformed JSON and missing reservoir crops', () => {
    expect(() => parseReservoirBackup('{broken')).toThrow('not valid JSON')

    const backup = validBackup()
    backup.reservoir_crop_ids = [999]
    expect(() => parseReservoirBackup(JSON.stringify(backup))).toThrow(
      'selects a crop that is not included',
    )
  })

  it('rejects impossible maintenance dates', () => {
    const backup = validBackup()
    backup.tasks[0].last_completed_date = '2026-02-31'
    expect(() => parseReservoirBackup(JSON.stringify(backup))).toThrow(
      'invalid maintenance task',
    )
  })
})

describe('CSV export', () => {
  it('exports chronological, spreadsheet-safe reading rows', () => {
    const later = { ...log, id: 10, timestamp: log.timestamp + 60_000, notes: 'Later' }
    const csv = createLogsCsv([later, log])

    expect(csv.startsWith('\uFEFFdate,time,ph,ec_mS_cm')).toBe(true)
    expect(csv).toContain('2026-08-18,08:30:00,6.1,1.4,21,0.5,"Adjusted, checked ""roots""",2026-08-18,08:35:00')
    expect(csv.indexOf('08:30:00')).toBeLessThan(csv.indexOf('08:31:00'))
  })

  it('uses dated, recognizable file names', () => {
    const date = new Date(2026, 7, 18)
    expect(backupFileName(date)).toBe('hydroponic-reservoir-backup-2026-08-18.json')
    expect(logsCsvFileName(date)).toBe('hydroponic-reservoir-logs-2026-08-18.csv')
  })
})
