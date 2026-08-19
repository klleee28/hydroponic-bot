import {
  db,
  type Crop,
  type MaintenanceTask,
  type ReservoirLog,
  type SeedlingBatch,
} from '../db/database'
import { toLocalDateString } from './dates'

const BACKUP_FORMAT = 'hydroponic-reservoir-backup'
const BACKUP_VERSION = 2

export interface ReservoirBackup {
  format: typeof BACKUP_FORMAT
  version: typeof BACKUP_VERSION
  exported_at: string
  crops: Crop[]
  logs: ReservoirLog[]
  tasks: MaintenanceTask[]
  seedling_batches: SeedlingBatch[]
  reservoir_crop_ids: number[]
}

export interface PreparedExport {
  kind: 'full-backup' | 'logs-csv'
  fileName: string
  mimeType: string
  contents: string
  description: string
}

export type SaveFileResult = 'shared' | 'downloaded' | 'cancelled'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function hasUniqueIds(items: Array<{ id: number }>): boolean {
  return new Set(items.map((item) => item.id)).size === items.length
}

function isCrop(value: unknown): value is Crop {
  if (!isRecord(value)) return false
  return isPositiveInteger(value.id)
    && typeof value.name === 'string'
    && value.name.trim().length > 0
    && isFiniteNumber(value.target_ph_min)
    && isFiniteNumber(value.target_ph_max)
    && value.target_ph_min < value.target_ph_max
    && isFiniteNumber(value.target_ec_min)
    && isFiniteNumber(value.target_ec_max)
    && value.target_ec_min < value.target_ec_max
}

function isReservoirLog(value: unknown): value is ReservoirLog {
  if (!isRecord(value)) return false
  return isPositiveInteger(value.id)
    && isFiniteNumber(value.timestamp)
    && value.timestamp > 0
    && (value.updated_at === undefined
      || (isFiniteNumber(value.updated_at) && value.updated_at > 0))
    && isFiniteNumber(value.ph)
    && value.ph >= 0
    && value.ph <= 14
    && isFiniteNumber(value.ec)
    && value.ec >= 0
    && isFiniteNumber(value.water_temp)
    && isFiniteNumber(value.water_added_liters)
    && value.water_added_liters >= 0
    && typeof value.notes === 'string'
}

function isLocalDate(value: unknown): value is string | null {
  if (value === null) return true
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const [year, month, day] = value.split('-').map(Number)
  return toLocalDateString(new Date(year, month - 1, day)) === value
}

function isMaintenanceTask(value: unknown): value is MaintenanceTask {
  if (!isRecord(value)) return false
  return isPositiveInteger(value.id)
    && typeof value.title === 'string'
    && value.title.trim().length > 0
    && isPositiveInteger(value.interval_days)
    && isLocalDate(value.last_completed_date)
}

function isSeedlingBatch(value: unknown): value is SeedlingBatch {
  if (!isRecord(value)) return false
  const validStatuses = new Set([
    'sown',
    'germinated',
    'seedling',
    'ready',
    'transferred',
    'discarded',
  ])
  return isPositiveInteger(value.id)
    && isPositiveInteger(value.crop_id)
    && typeof value.cultivar === 'string'
    && isPositiveInteger(value.quantity_sown)
    && typeof value.plug_medium === 'string'
    && value.plug_medium.trim().length > 0
    && isFiniteNumber(value.sown_at)
    && value.sown_at > 0
    && (value.emerged_at === null || (isFiniteNumber(value.emerged_at) && value.emerged_at > 0))
    && Number.isInteger(value.germinated_count)
    && Number(value.germinated_count) >= 0
    && Number(value.germinated_count) <= Number(value.quantity_sown)
    && Number.isInteger(value.true_leaf_count)
    && Number(value.true_leaf_count) >= 0
    && isPositiveInteger(value.target_true_leaves)
    && typeof value.roots_visible === 'boolean'
    && typeof value.plug_stable === 'boolean'
    && typeof value.healthy === 'boolean'
    && typeof value.status === 'string'
    && validStatuses.has(value.status)
    && (value.transferred_at === null
      || (isFiniteNumber(value.transferred_at) && value.transferred_at > 0))
    && Number.isInteger(value.transferred_count)
    && Number(value.transferred_count) >= 0
    && typeof value.channel_name === 'string'
    && typeof value.root_contact_confirmed === 'boolean'
    && typeof value.notes === 'string'
    && isFiniteNumber(value.updated_at)
    && value.updated_at > 0
}

function validateBackup(value: unknown): void {
  if (!isRecord(value)) throw new Error('The selected file is not a backup object.')
  if (value.format !== BACKUP_FORMAT || (value.version !== 1 && value.version !== BACKUP_VERSION)) {
    throw new Error('This backup format or version is not supported.')
  }
  if (
    typeof value.exported_at !== 'string'
    || Number.isNaN(Date.parse(value.exported_at))
  ) {
    throw new Error('The backup export date is invalid.')
  }
  if (!Array.isArray(value.crops) || !value.crops.every(isCrop) || !value.crops.length) {
    throw new Error('The backup must contain at least one valid crop.')
  }
  if (!hasUniqueIds(value.crops)) throw new Error('The backup contains duplicate crop IDs.')
  if (!Array.isArray(value.logs) || !value.logs.every(isReservoirLog)) {
    throw new Error('The backup contains an invalid reservoir log.')
  }
  if (!hasUniqueIds(value.logs)) throw new Error('The backup contains duplicate log IDs.')
  if (!Array.isArray(value.tasks) || !value.tasks.every(isMaintenanceTask)) {
    throw new Error('The backup contains an invalid maintenance task.')
  }
  if (!hasUniqueIds(value.tasks)) throw new Error('The backup contains duplicate task IDs.')
  if (
    value.version === BACKUP_VERSION
    && (!Array.isArray(value.seedling_batches) || !value.seedling_batches.every(isSeedlingBatch))
  ) {
    throw new Error('The backup contains an invalid seedling batch.')
  }
  if (Array.isArray(value.seedling_batches) && !hasUniqueIds(value.seedling_batches)) {
    throw new Error('The backup contains duplicate seedling batch IDs.')
  }
  if (
    !Array.isArray(value.reservoir_crop_ids)
    || !value.reservoir_crop_ids.length
    || !value.reservoir_crop_ids.every(isPositiveInteger)
  ) {
    throw new Error('The backup has no valid reservoir crop selection.')
  }

  const cropIds = new Set(value.crops.map((crop) => crop.id))
  const selection = new Set(value.reservoir_crop_ids)
  if (selection.size !== value.reservoir_crop_ids.length) {
    throw new Error('The backup contains duplicate selected crop IDs.')
  }
  if (!value.reservoir_crop_ids.every((id) => cropIds.has(id))) {
    throw new Error('The backup selects a crop that is not included in the file.')
  }
  if (
    Array.isArray(value.seedling_batches)
    && value.seedling_batches.some((batch) => !cropIds.has(batch.crop_id))
  ) {
    throw new Error('The backup contains a seedling batch for a missing crop.')
  }
}

export function parseReservoirBackup(contents: string): ReservoirBackup {
  let parsed: unknown
  try {
    parsed = JSON.parse(contents)
  } catch {
    throw new Error('The selected file is not valid JSON.')
  }
  validateBackup(parsed)
  const backup = parsed as Omit<ReservoirBackup, 'version' | 'seedling_batches'> & {
    version: 1 | 2
    seedling_batches?: SeedlingBatch[]
  }
  return {
    ...backup,
    version: BACKUP_VERSION,
    seedling_batches: backup.seedling_batches ?? [],
  }
}

export async function createReservoirBackup(
  reservoirCropIds: number[],
  now: Date = new Date(),
): Promise<ReservoirBackup> {
  const [crops, logs, tasks, seedlingBatches] = await Promise.all([
    db.crops.orderBy('id').toArray(),
    db.logs.orderBy('timestamp').toArray(),
    db.tasks.orderBy('id').toArray(),
    db.seedling_batches.orderBy('sown_at').toArray(),
  ])

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exported_at: now.toISOString(),
    crops,
    logs,
    tasks,
    seedling_batches: seedlingBatches,
    reservoir_crop_ids: [...reservoirCropIds],
  }
}

export async function restoreReservoirBackup(
  backup: ReservoirBackup,
): Promise<number[]> {
  validateBackup(backup)

  await db.transaction('rw', [db.crops, db.logs, db.tasks, db.seedling_batches], async () => {
    await Promise.all([
      db.crops.clear(),
      db.logs.clear(),
      db.tasks.clear(),
      db.seedling_batches.clear(),
    ])
    await Promise.all([
      db.crops.bulkAdd(backup.crops),
      backup.logs.length
        ? db.logs.bulkAdd(backup.logs.map((log) => ({
            ...log,
            updated_at: log.updated_at ?? log.timestamp,
          })))
        : Promise.resolve(),
      backup.tasks.length ? db.tasks.bulkAdd(backup.tasks) : Promise.resolve(),
      backup.seedling_batches.length
        ? db.seedling_batches.bulkAdd(backup.seedling_batches)
        : Promise.resolve(),
    ])
  })

  return [...backup.reservoir_crop_ids]
}

function csvCell(value: string | number): string {
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function localTimeString(timestamp: number): string {
  const date = new Date(timestamp)
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((part) => String(part).padStart(2, '0'))
    .join(':')
}

export function createLogsCsv(logs: ReservoirLog[]): string {
  const rows: Array<Array<string | number>> = [[
    'date',
    'time',
    'ph',
    'ec_mS_cm',
    'water_temp_C',
    'water_added_liters',
    'notes',
    'updated_date',
    'updated_time',
  ]]

  for (const log of [...logs].sort((first, second) => first.timestamp - second.timestamp)) {
    rows.push([
      toLocalDateString(new Date(log.timestamp)),
      localTimeString(log.timestamp),
      log.ph,
      log.ec,
      log.water_temp,
      log.water_added_liters,
      log.notes,
      toLocalDateString(new Date(log.updated_at ?? log.timestamp)),
      localTimeString(log.updated_at ?? log.timestamp),
    ])
  }

  return `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`
}

export function backupFileName(date: Date = new Date()): string {
  return `hydroponic-reservoir-backup-${toLocalDateString(date)}.json`
}

export function logsCsvFileName(date: Date = new Date()): string {
  return `hydroponic-reservoir-logs-${toLocalDateString(date)}.csv`
}

export async function savePreparedExport(
  prepared: PreparedExport,
): Promise<SaveFileResult> {
  const file = new File([prepared.contents], prepared.fileName, {
    type: prepared.mimeType,
  })
  const shareData = { files: [file], title: prepared.description }

  if (navigator.share && navigator.canShare?.(shareData)) {
    try {
      await navigator.share(shareData)
      return 'shared'
    } catch (reason: unknown) {
      if (reason instanceof DOMException && reason.name === 'AbortError') {
        return 'cancelled'
      }
      // Some installed browsers report file sharing support but reject the
      // native share request. Continue to the deterministic download fallback.
    }
  }

  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = prepared.fileName
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
  return 'downloaded'
}
