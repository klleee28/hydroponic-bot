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
  propagation_ph_min: number | null
  propagation_ph_max: number | null
  propagation_ec_target: number | null
  propagation_ph: number | null
  propagation_ec: number | null
  solution_checked_at: number | null
  plug_evenly_moist: boolean
  complete_nutrient_prepared: boolean
  dome_removed: boolean
  light_provided: boolean
  status: SeedlingStage
  transferred_at: number | null
  transferred_count: number
  channel_name: string
  root_contact_confirmed: boolean
  notes: string
  updated_at: number
}

export type GrowAreaType = 'nft-channel' | 'seedling-tray' | 'grid'

export interface GrowArea {
  id: number
  name: string
  type: GrowAreaType
  rows: number
  columns: number
  created_at: number
  updated_at: number
}

/** A current, single-plant position in a user-defined grow area. */
export interface GrowPosition {
  id: number
  area_id: number
  row: number
  column: number
  position_code: string
  crop_id: number | null
  seedling_batch_id: number | null
  assigned_at: number | null
  updated_at: number
}

/** Append-only history of the user-recorded layout changes. */
export interface LayoutActivity {
  id: number
  action: 'assigned' | 'cleared'
  area_id: number
  area_name: string
  position_id: number
  position_code: string
  crop_id: number | null
  seedling_batch_id: number | null
  item_label: string
  timestamp: number
}

export const db = new Dexie('HydroponicReservoirDB') as Dexie & {
  crops: EntityTable<Crop, 'id'>
  logs: EntityTable<ReservoirLog, 'id'>
  tasks: EntityTable<MaintenanceTask, 'id'>
  seedling_batches: EntityTable<SeedlingBatch, 'id'>
  grow_areas: EntityTable<GrowArea, 'id'>
  grow_positions: EntityTable<GrowPosition, 'id'>
  layout_activity: EntityTable<LayoutActivity, 'id'>
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

db.version(4)
  .stores({
    crops: '++id',
    logs: '++id,timestamp',
    tasks: '++id',
    seedling_batches: '++id,crop_id,sown_at,status',
  })
  .upgrade(async (transaction) => {
    const crops = await transaction.table<Crop>('crops').toArray()
    const cropNames = new Map(crops.map((crop) => [crop.id, crop.name]))
    await transaction
      .table<SeedlingBatch>('seedling_batches')
      .toCollection()
      .modify((batch) => {
        const isLettuce = (cropNames.get(batch.crop_id) ?? '')
          .toLocaleLowerCase()
          .includes('lettuce')
        batch.propagation_ph_min ??= isLettuce ? 5.5 : null
        batch.propagation_ph_max ??= isLettuce ? 6 : null
        batch.propagation_ec_target ??= isLettuce ? 1 : null
        batch.propagation_ph ??= null
        batch.propagation_ec ??= null
        batch.solution_checked_at ??= null
        batch.plug_evenly_moist ??= false
        batch.complete_nutrient_prepared ??= false
        batch.dome_removed ??= false
        batch.light_provided ??= false
      })
  })

db.version(5).stores({
  crops: '++id',
  logs: '++id,timestamp',
  tasks: '++id',
  seedling_batches: '++id,crop_id,sown_at,status',
  grow_areas: '++id,updated_at',
  grow_positions: '++id,area_id,[area_id+position_code],crop_id,seedling_batch_id',
  layout_activity: '++id,timestamp,area_id,position_id,crop_id,seedling_batch_id',
})
