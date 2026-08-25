import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  BookOpen,
  CalendarCheck2,
  Download,
  FileJson2,
  FileSpreadsheet,
  Leaf,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  Wrench,
} from 'lucide-react'
import { Modal } from '../components/Modal'
import { ScreenHeader } from '../components/ScreenHeader'
import { db, type Crop } from '../db/database'
import {
  formatDueLabel,
  getNextDueDate,
  parseLocalDate,
  toLocalDateString,
} from '../lib/dates'
import {
  CROP_LIBRARY,
  CROP_LIBRARY_SOURCE,
  cropsMatchPreset,
  type CropPreset,
} from '../lib/cropLibrary'
import { getSharedCropThresholds } from '../lib/thresholds'
import { getNextBackupDueAt, isBackupDue } from '../lib/backupSchedule'
import {
  deleteCrop as deleteCropRecord,
  getCropDeletionBlocker,
} from '../lib/deletion'
import {
  validateCropInput,
  type CropFormInput,
} from '../lib/cropValidation'
import {
  backupFileName,
  createLogsCsv,
  createReservoirBackup,
  logsCsvFileName,
  parseReservoirBackup,
  restoreReservoirBackup,
  savePreparedExport,
  type PreparedExport,
  type ReservoirBackup,
} from '../lib/backup'

interface SettingsScreenProps {
  reservoirCropIds: number[]
  lastBackupAt: number | null
  onBackupCompleted: (timestamp: number) => void
  onReservoirCropsChange: (ids: number[]) => void
}

type CropFormState = CropFormInput

const EMPTY_CROP: CropFormState = {
  name: '',
  target_ph_min: '5.8',
  target_ph_max: '6.4',
  target_ec_min: '1.2',
  target_ec_max: '1.6',
}

function formatCalendarDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parseLocalDate(value))
}

export default function SettingsScreen({
  reservoirCropIds,
  lastBackupAt,
  onBackupCompleted,
  onReservoirCropsChange,
}: SettingsScreenProps) {
  const crops = useLiveQuery(() => db.crops.toArray(), [], [])
  const tasks = useLiveQuery(() => db.tasks.toArray(), [], [])
  const reservoirCropIdSet = useMemo(
    () => new Set(reservoirCropIds),
    [reservoirCropIds],
  )
  const selectedCrops = useMemo(
    () => crops.filter((crop) => reservoirCropIdSet.has(crop.id)),
    [crops, reservoirCropIdSet],
  )
  const sharedThresholds = useMemo(
    () => getSharedCropThresholds(selectedCrops),
    [selectedCrops],
  )
  const [cropDraft, setCropDraft] = useState<CropFormState | null>(null)
  const [editingCropId, setEditingCropId] = useState<number | null>(null)
  const [cropDeleteError, setCropDeleteError] = useState<string | null>(null)
  const [cropValidationError, setCropValidationError] = useState<string | null>(null)
  const [taskDraft, setTaskDraft] = useState({ title: '', interval_days: 14 })
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [showLibraryModal, setShowLibraryModal] = useState(false)
  const [librarySearch, setLibrarySearch] = useState('')
  const [preparedExport, setPreparedExport] = useState<PreparedExport | null>(null)
  const [pendingBackup, setPendingBackup] = useState<ReservoirBackup | null>(null)
  const [dataMessage, setDataMessage] = useState<string | null>(null)
  const [dataError, setDataError] = useState<string | null>(null)
  const [dataBusy, setDataBusy] = useState(false)
  const backupInputRef = useRef<HTMLInputElement>(null)

  const filteredPresets = useMemo(() => {
    const query = librarySearch.trim().toLocaleLowerCase()
    if (!query) return CROP_LIBRARY
    return CROP_LIBRARY.filter((preset) =>
      preset.name.toLocaleLowerCase().includes(query),
    )
  }, [librarySearch])

  const orderedTasks = useMemo(
    () =>
      tasks
        .map((task) => ({
          ...task,
          due: getNextDueDate(task.last_completed_date, task.interval_days),
        }))
        .sort((a, b) => a.due.localeCompare(b.due)),
    [tasks],
  )

  const openNewCrop = () => {
    setEditingCropId(null)
    setCropDeleteError(null)
    setCropValidationError(null)
    setCropDraft({ ...EMPTY_CROP })
  }

  const openEditCrop = (crop: Crop) => {
    setEditingCropId(crop.id)
    setCropDeleteError(null)
    setCropValidationError(null)
    setCropDraft({
      name: crop.name,
      target_ph_min: String(crop.target_ph_min),
      target_ph_max: String(crop.target_ph_max),
      target_ec_min: String(crop.target_ec_min),
      target_ec_max: String(crop.target_ec_max),
    })
  }

  const toggleReservoirCrop = (id: number) => {
    if (reservoirCropIdSet.has(id)) {
      if (reservoirCropIds.length === 1) return
      onReservoirCropsChange(
        reservoirCropIds.filter((cropId) => cropId !== id),
      )
      return
    }

    onReservoirCropsChange([...reservoirCropIds, id])
  }

  const updateCropDraft = (key: keyof CropFormState, value: string) => {
    setCropValidationError(null)
    setCropDraft((current) => {
      if (!current) return current
      return {
        ...current,
        [key]: value,
      }
    })
  }

  const saveCrop = async () => {
    if (!cropDraft) return
    setCropValidationError(null)

    const validation = validateCropInput(cropDraft)
    if (!validation.valid || !validation.crop) {
      setCropValidationError(validation.error ?? 'Invalid crop input.')
      return
    }

    if (editingCropId) {
      await db.crops.update(editingCropId, validation.crop)
    } else {
      const id = await db.crops.add(validation.crop)
      onReservoirCropsChange([...reservoirCropIds, id])
    }
    setCropDraft(null)
  }

  const removeCrop = async () => {
    if (!editingCropId) return
    setCropDeleteError(null)
    const blocker = await getCropDeletionBlocker(editingCropId)
    if (blocker === 'last-crop') {
      setCropDeleteError('Keep at least one crop in the app. Add another crop before deleting this one.')
      return
    }
    if (blocker === 'seedling-batches') {
      setCropDeleteError('This crop still has seedling batches. Delete those batches first to preserve data integrity.')
      return
    }

    const cropName = crops.find((crop) => crop.id === editingCropId)?.name ?? 'this crop'
    if (!window.confirm(`Permanently delete ${cropName}? This cannot be undone.`)) return

    try {
      await deleteCropRecord(editingCropId)
      if (reservoirCropIdSet.has(editingCropId)) {
        const remainingCrops = crops.filter((crop) => crop.id !== editingCropId)
        const remainingSelectedIds = reservoirCropIds.filter((id) => id !== editingCropId)
        onReservoirCropsChange(
          remainingSelectedIds.length ? remainingSelectedIds : [remainingCrops[0].id],
        )
      }
      setCropDraft(null)
      setEditingCropId(null)
      setDataMessage(`${cropName} deleted.`)
    } catch (reason: unknown) {
      setCropDeleteError(reason instanceof Error ? reason.message : 'Could not delete crop.')
    }
  }

  const addLibraryCrop = async (preset: CropPreset) => {
    const existing = crops.find((crop) => cropsMatchPreset(crop, preset))
    let cropId = existing?.id

    if (!cropId) {
      const nameExists = crops.some((crop) => crop.name === preset.name)
      cropId = await db.crops.add({
        ...preset,
        name: nameExists ? `${preset.name} (OSU preset)` : preset.name,
      })
    }

    if (!reservoirCropIdSet.has(cropId)) {
      onReservoirCropsChange([...reservoirCropIds, cropId])
    }
    setLibrarySearch('')
    setShowLibraryModal(false)
  }

  const addTask = async () => {
    if (!taskDraft.title.trim() || taskDraft.interval_days < 1) return
    await db.tasks.add({
      title: taskDraft.title.trim(),
      interval_days: Math.round(taskDraft.interval_days),
      last_completed_date: null,
    })
    setTaskDraft({ title: '', interval_days: 14 })
    setShowTaskModal(false)
  }

  const prepareFullBackup = async () => {
    setDataBusy(true)
    setDataError(null)
    setDataMessage(null)
    try {
      const now = new Date()
      const backup = await createReservoirBackup(reservoirCropIds, now)
      setPreparedExport({
        kind: 'full-backup',
        fileName: backupFileName(now),
        mimeType: 'application/json',
        contents: JSON.stringify(backup, null, 2),
        description: 'Hydroponic reservoir backup',
      })
    } catch (reason: unknown) {
      setDataError(reason instanceof Error ? reason.message : 'Could not prepare backup.')
    } finally {
      setDataBusy(false)
    }
  }

  const prepareLogsCsv = async () => {
    setDataBusy(true)
    setDataError(null)
    setDataMessage(null)
    try {
      const now = new Date()
      const logs = await db.logs.orderBy('timestamp').toArray()
      setPreparedExport({
        kind: 'logs-csv',
        fileName: logsCsvFileName(now),
        mimeType: 'text/csv;charset=utf-8',
        contents: createLogsCsv(logs),
        description: 'Hydroponic reservoir readings',
      })
    } catch (reason: unknown) {
      setDataError(reason instanceof Error ? reason.message : 'Could not prepare CSV.')
    } finally {
      setDataBusy(false)
    }
  }

  const saveExport = async () => {
    if (!preparedExport) return
    try {
      const result = await savePreparedExport(preparedExport)
      if (result === 'cancelled') return
      setDataMessage(
        result === 'shared'
          ? 'File shared successfully.'
          : 'File downloaded successfully.',
      )
      if (preparedExport.kind === 'full-backup') {
        onBackupCompleted(Date.now())
      }
      setPreparedExport(null)
    } catch (reason: unknown) {
      setDataError(reason instanceof Error ? reason.message : 'Could not save file.')
      setPreparedExport(null)
    }
  }

  const chooseBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    input.value = ''
    if (!file) return

    setDataBusy(true)
    setDataError(null)
    setDataMessage(null)
    try {
      setPendingBackup(parseReservoirBackup(await file.text()))
    } catch (reason: unknown) {
      setDataError(
        reason instanceof Error ? reason.message : 'Could not read backup file.',
      )
    } finally {
      setDataBusy(false)
    }
  }

  const confirmRestore = async () => {
    if (!pendingBackup) return
    setDataBusy(true)
    setDataError(null)
    try {
      const selectedIds = await restoreReservoirBackup(pendingBackup)
      onReservoirCropsChange(selectedIds)
      setPendingBackup(null)
      setDataMessage('Backup restored successfully on this device.')
    } catch (reason: unknown) {
      setDataError(reason instanceof Error ? reason.message : 'Could not restore backup.')
    } finally {
      setDataBusy(false)
    }
  }

  return (
    <div className="screen">
      <ScreenHeader title="Settings" />

      <section className="settings-section">
        <h2>Crops in this reservoir</h2>
        <p className="settings-helper">
          Select once. Every reservoir reading applies to all selected crops.
        </p>
        <div className="crop-membership-list">
          {crops.map((crop) => {
            const selected = reservoirCropIdSet.has(crop.id)
            const isOnlySelectedCrop = selected && reservoirCropIds.length === 1

            return (
              <article className="crop-membership-row" key={crop.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={isOnlySelectedCrop}
                    onChange={() => toggleReservoirCrop(crop.id)}
                  />
                  <Leaf size={22} aria-hidden="true" />
                  <span>
                    <strong>{crop.name}</strong>
                    <small>
                      pH {crop.target_ph_min.toFixed(1)}–{crop.target_ph_max.toFixed(1)} · EC{' '}
                      {crop.target_ec_min.toFixed(1)}–{crop.target_ec_max.toFixed(1)}
                    </small>
                  </span>
                </label>
                <button
                  type="button"
                  className="crop-edit-button"
                  aria-label={`Edit ${crop.name}`}
                  onClick={() => openEditCrop(crop)}
                >
                  <Pencil size={18} aria-hidden="true" />
                </button>
              </article>
            )
          })}
        </div>
        <p className="settings-footnote">At least one crop must remain selected.</p>
      </section>

      <section className="settings-section">
        <div className="section-heading-row">
          <h2>Shared safe range</h2>
        </div>
        {!sharedThresholds?.compatible ? (
          <div className="range-conflict" role="alert">
            No complete overlap. Edit crop thresholds or remove an incompatible
            crop from this reservoir.
          </div>
        ) : null}
        <div className="settings-list">
          <div className="settings-row">
            <span>pH range</span>
            <strong>
              {sharedThresholds?.ph.compatible
                ? `${sharedThresholds.ph.minimum.toFixed(1)} – ${sharedThresholds.ph.maximum.toFixed(1)}`
                : 'No overlap'}
            </strong>
          </div>
          <div className="settings-row">
            <span>EC range (mS/cm)</span>
            <strong>
              {sharedThresholds?.ec.compatible
                ? `${sharedThresholds.ec.minimum.toFixed(2)} – ${sharedThresholds.ec.maximum.toFixed(2)}`
                : 'No overlap'}
            </strong>
          </div>
        </div>
        <div className="settings-button-stack">
          <button
            type="button"
            className="outline-button"
            onClick={() => setShowLibraryModal(true)}
          >
            <BookOpen size={20} aria-hidden="true" /> Add from crop library
          </button>
          <button type="button" className="outline-button" onClick={openNewCrop}>
            <Plus size={20} aria-hidden="true" /> Add custom crop
          </button>
        </div>
      </section>

      <section className="settings-section">
        <h2>Maintenance</h2>
        <div className="task-list">
          {orderedTasks.map((task) => (
            <article className="task-row" key={task.id}>
              <div className="task-row__icon">
                <Wrench size={22} aria-hidden="true" />
              </div>
              <div className="task-row__content">
                <strong>{task.title}</strong>
                <span>Every {task.interval_days} days</span>
                {task.last_completed_date ? (
                  <small>Last done {formatCalendarDate(task.last_completed_date)}</small>
                ) : (
                  <small>Not completed yet</small>
                )}
              </div>
              <div className="task-row__action">
                <em>{formatDueLabel(task.due)}</em>
                <button
                  type="button"
                  aria-label={`Mark ${task.title} complete`}
                  onClick={() =>
                    db.tasks.update(task.id, {
                      last_completed_date: toLocalDateString(),
                    })
                  }
                >
                  <CalendarCheck2 size={18} aria-hidden="true" /> Done
                </button>
              </div>
            </article>
          ))}
        </div>
        <button
          type="button"
          className="outline-button"
          onClick={() => setShowTaskModal(true)}
        >
          <Plus size={20} aria-hidden="true" /> Add maintenance item
        </button>
      </section>

      <section className="settings-section">
        <div className="backup-heading">
          <div>
            <h2>Backup & data</h2>
            <p className="settings-helper">
              Save to Files or iCloud so your local records can be recovered.
            </p>
            <p className={`backup-schedule${isBackupDue(lastBackupAt) ? ' backup-schedule--due' : ''}`}>
              {lastBackupAt === null
                ? 'No full backup saved yet · weekly reminder active'
                : isBackupDue(lastBackupAt)
                  ? `Last full backup ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(lastBackupAt))} · due now`
                  : `Last full backup ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(lastBackupAt))} · next due ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(getNextBackupDueAt(lastBackupAt)))}`}
            </p>
          </div>
          <ShieldCheck size={25} aria-hidden="true" />
        </div>
        <div className="backup-actions">
          <button
            type="button"
            disabled={dataBusy}
            onClick={prepareFullBackup}
          >
            <FileJson2 size={21} aria-hidden="true" />
            <span>
              <strong>Full JSON backup</strong>
              <small>All crops, logs, tasks, and settings</small>
            </span>
            <Download size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={dataBusy}
            onClick={prepareLogsCsv}
          >
            <FileSpreadsheet size={21} aria-hidden="true" />
            <span>
              <strong>Readings CSV</strong>
              <small>Open your history in a spreadsheet</small>
            </span>
            <Download size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={dataBusy}
            onClick={() => backupInputRef.current?.click()}
          >
            <Upload size={21} aria-hidden="true" />
            <span>
              <strong>Restore JSON backup</strong>
              <small>Validate a file before replacing local data</small>
            </span>
          </button>
        </div>
        <input
          ref={backupInputRef}
          className="hidden-file-input"
          type="file"
          accept=".json,application/json"
          onChange={chooseBackup}
        />
        {dataMessage ? <p className="data-message" role="status">{dataMessage}</p> : null}
        {dataError ? <p className="data-error" role="alert">{dataError}</p> : null}
      </section>

      {cropDraft ? (
        <Modal
          title={editingCropId ? 'Edit crop' : 'Add custom crop'}
          onClose={() => {
            setCropDraft(null)
            setCropDeleteError(null)
            setCropValidationError(null)
          }}
        >
          <div className="form-stack">
            <label>
              <span>Crop name</span>
              <input
                value={cropDraft.name}
                onChange={(event) => updateCropDraft('name', event.target.value)}
              />
            </label>
            <div className="form-grid">
              <label>
                <span>Minimum pH</span>
                <input
                  inputMode="decimal"
                  value={cropDraft.target_ph_min}
                  onChange={(event) =>
                    updateCropDraft('target_ph_min', event.target.value)
                  }
                />
              </label>
              <label>
                <span>Maximum pH</span>
                <input
                  inputMode="decimal"
                  value={cropDraft.target_ph_max}
                  onChange={(event) =>
                    updateCropDraft('target_ph_max', event.target.value)
                  }
                />
              </label>
              <label>
                <span>Minimum EC</span>
                <input
                  inputMode="decimal"
                  value={cropDraft.target_ec_min}
                  onChange={(event) =>
                    updateCropDraft('target_ec_min', event.target.value)
                  }
                />
              </label>
              <label>
                <span>Maximum EC</span>
                <input
                  inputMode="decimal"
                  value={cropDraft.target_ec_max}
                  onChange={(event) =>
                    updateCropDraft('target_ec_max', event.target.value)
                  }
                />
              </label>
            </div>
            <button type="button" className="primary-button" onClick={saveCrop}>
              Save crop
            </button>
            {editingCropId ? (
              <button type="button" className="delete-record-button" onClick={removeCrop}>
                <Trash2 size={18} aria-hidden="true" /> Delete crop
              </button>
            ) : null}
            {cropValidationError ? (
              <p className="modal-delete-error" role="alert">{cropValidationError}</p>
            ) : null}
            {cropDeleteError ? (
              <p className="modal-delete-error" role="alert">{cropDeleteError}</p>
            ) : null}
          </div>
        </Modal>
      ) : null}

      {showLibraryModal ? (
        <Modal
          title="Crop library"
          onClose={() => {
            setLibrarySearch('')
            setShowLibraryModal(false)
          }}
        >
          <div className="crop-library-intro">
            <p>
              Offline starting ranges for general hydroponic crops. Add a
              preset, then edit it if your cultivar or system needs a different
              range.
            </p>
            <a
              href={CROP_LIBRARY_SOURCE.url}
              target="_blank"
              rel="noreferrer"
            >
              Source: {CROP_LIBRARY_SOURCE.title}
            </a>
          </div>
          <label className="crop-library-search">
            <span className="sr-only">Search crop presets</span>
            <Search size={19} aria-hidden="true" />
            <input
              type="search"
              inputMode="search"
              value={librarySearch}
              placeholder="Search crops"
              onChange={(event) => setLibrarySearch(event.target.value)}
            />
          </label>
          <div className="crop-library-list">
            {filteredPresets.map((preset) => {
              const savedCrop = crops.find((crop) =>
                cropsMatchPreset(crop, preset),
              )
              const isSelected = savedCrop
                ? reservoirCropIdSet.has(savedCrop.id)
                : false

              return (
                <article className="crop-library-row" key={preset.name}>
                  <div>
                    <strong>{preset.name}</strong>
                    <span>
                      pH {preset.target_ph_min.toFixed(1)}–{preset.target_ph_max.toFixed(1)} · EC{' '}
                      {preset.target_ec_min.toFixed(1)}–{preset.target_ec_max.toFixed(1)}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={isSelected}
                    aria-label={`${isSelected ? 'Selected' : 'Add'} ${preset.name} preset`}
                    onClick={() => addLibraryCrop(preset)}
                  >
                    {isSelected ? 'Selected' : 'Add'}
                  </button>
                </article>
              )
            })}
            {!filteredPresets.length ? (
              <p className="crop-library-empty">No matching crop preset.</p>
            ) : null}
          </div>
        </Modal>
      ) : null}

      {preparedExport ? (
        <Modal title="File ready" onClose={() => setPreparedExport(null)}>
          <div className="backup-ready">
            <FileJson2 size={34} aria-hidden="true" />
            <p>
              <strong>{preparedExport.fileName}</strong>
              Choose Save or share, then store the file in Files, iCloud Drive,
              or another location you control.
            </p>
          </div>
          <button type="button" className="primary-button" onClick={saveExport}>
            <Download size={19} aria-hidden="true" /> Save or share file
          </button>
        </Modal>
      ) : null}

      {pendingBackup ? (
        <Modal title="Replace local data?" onClose={() => setPendingBackup(null)}>
          <div className="restore-warning" role="alert">
            This will replace every crop, reading, and maintenance task currently
            stored on this device.
          </div>
          <dl className="backup-summary">
            <div><dt>Crops</dt><dd>{pendingBackup.crops.length}</dd></div>
            <div><dt>Readings</dt><dd>{pendingBackup.logs.length}</dd></div>
            <div><dt>Tasks</dt><dd>{pendingBackup.tasks.length}</dd></div>
            <div><dt>Seedling batches</dt><dd>{pendingBackup.seedling_batches.length}</dd></div>
            <div>
              <dt>Exported</dt>
              <dd>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(pendingBackup.exported_at))}</dd>
            </div>
          </dl>
          <div className="restore-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setPendingBackup(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="danger-button"
              disabled={dataBusy}
              onClick={confirmRestore}
            >
              Restore and replace
            </button>
          </div>
        </Modal>
      ) : null}

      {showTaskModal ? (
        <Modal title="Add maintenance item" onClose={() => setShowTaskModal(false)}>
          <div className="form-stack">
            <label>
              <span>Task title</span>
              <input
                value={taskDraft.title}
                onChange={(event) =>
                  setTaskDraft((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>Repeat every (days)</span>
              <input
                inputMode="numeric"
                value={taskDraft.interval_days}
                onChange={(event) =>
                  setTaskDraft((current) => ({
                    ...current,
                    interval_days: Number(event.target.value),
                  }))
                }
              />
            </label>
            <button type="button" className="primary-button" onClick={addTask}>
              Add task
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
