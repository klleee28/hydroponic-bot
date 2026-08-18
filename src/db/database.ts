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

export const db = new Dexie('HydroponicReservoirDB') as Dexie & {
  crops: EntityTable<Crop, 'id'>
  logs: EntityTable<ReservoirLog, 'id'>
  tasks: EntityTable<MaintenanceTask, 'id'>
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
