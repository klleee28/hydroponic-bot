import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  db,
  type Crop,
  type MaintenanceTask,
  type ReservoirLog,
  type SeedlingBatch,
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
  status: 'sown',
  transferred_at: null,
  transferred_count: 0,
  channel_name: '',
  root_contact_confirmed: false,
  notes: '',
  updated_at: new Date(2026, 7, 18, 7, 30).getTime(),
}

function validBackup(): ReservoirBackup {
  return {
    format: 'hydroponic-reservoir-backup',
    version: 2,
    exported_at: '2026-08-18T08:00:00.000Z',
    crops: [crop],
    logs: [log],
    tasks: [task],
    seedling_batches: [seedlingBatch],
    reservoir_crop_ids: [crop.id],
  }
}

describe('reservoir backup', () => {
  beforeEach(async () => {
    await db.transaction('rw', [db.crops, db.logs, db.tasks, db.seedling_batches], async () => {
      await Promise.all([
        db.crops.clear(),
        db.logs.clear(),
        db.tasks.clear(),
        db.seedling_batches.clear(),
      ])
    })
  })

  it('exports every local table and the reservoir crop selection', async () => {
    await Promise.all([
      db.crops.add(crop),
      db.logs.add(log),
      db.tasks.add(task),
      db.seedling_batches.add(seedlingBatch),
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
    expect(parsed.version).toBe(2)
    expect(parsed.seedling_batches).toEqual([])
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
