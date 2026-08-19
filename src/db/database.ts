import Dexie, { type EntityTable } from 'dexie'

export interface Crop {
  id: number
  name: string
  target_ph_min: number
  target_ph_max: number
  target_ec_min: number
  target_ec_max: number
}

export interface ReservoirLog {
  id: number
  timestamp: number
  updated_at: number
  ph: number
  ec: number
  water_temp: number
  water_added_liters: number
  notes: string
}

export interface MaintenanceTask {
  id: number
  title: string
  interval_days: number
  last_completed_date: string | null
}

export type SeedlingStage =
  | 'sown'
  | 'germinated'
  | 'seedling'
  | 'ready'
  | 'transferred'
  | 'discarded'

export interface SeedlingBatch {
  id: number
  crop_id: number
  cultivar: string
  quantity_sown: number
  plug_medium: string
  sown_at: number
  emerged_at: number | null
  germinated_count: number
  true_leaf_count: number
  target_true_leaves: number
  roots_visible: boolean
  plug_stable: boolean
  healthy: boolean
  status: SeedlingStage
  transferred_at: number | null
  transferred_count: number
  channel_name: string
  root_contact_confirmed: boolean
  notes: string
  updated_at: number
}

export const db = new Dexie('HydroponicReservoirDB') as Dexie & {
  crops: EntityTable<Crop, 'id'>
  logs: EntityTable<ReservoirLog, 'id'>
  tasks: EntityTable<MaintenanceTask, 'id'>
  seedling_batches: EntityTable<SeedlingBatch, 'id'>
}

db.version(1).stores({
  crops: '++id',
  logs: '++id,timestamp',
  tasks: '++id',
})

db.version(2)
  .stores({
    crops: '++id',
    logs: '++id,timestamp',
    tasks: '++id',
  })
  .upgrade((transaction) =>
    transaction
      .table<ReservoirLog>('logs')
      .toCollection()
      .modify((log) => {
        log.updated_at ??= log.timestamp
      }),
  )

db.version(3).stores({
  crops: '++id',
  logs: '++id,timestamp',
  tasks: '++id',
  seedling_batches: '++id,crop_id,sown_at,status',
})
