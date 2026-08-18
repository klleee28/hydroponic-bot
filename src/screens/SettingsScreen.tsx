import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  BookOpen,
  CalendarCheck2,
  Leaf,
  Pencil,
  Plus,
  Search,
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

interface SettingsScreenProps {
  reservoirCropIds: number[]
  onReservoirCropsChange: (ids: number[]) => void
}

type CropDraft = Omit<Crop, 'id'>

const EMPTY_CROP: CropDraft = {
  name: '',
  target_ph_min: 5.8,
  target_ph_max: 6.4,
  target_ec_min: 1.2,
  target_ec_max: 1.6,
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
  const [cropDraft, setCropDraft] = useState<CropDraft | null>(null)
  const [editingCropId, setEditingCropId] = useState<number | null>(null)
  const [taskDraft, setTaskDraft] = useState({ title: '', interval_days: 14 })
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [showLibraryModal, setShowLibraryModal] = useState(false)
  const [librarySearch, setLibrarySearch] = useState('')

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
    setCropDraft({ ...EMPTY_CROP })
  }

  const openEditCrop = (crop: Crop) => {
    setEditingCropId(crop.id)
    setCropDraft({
      name: crop.name,
      target_ph_min: crop.target_ph_min,
      target_ph_max: crop.target_ph_max,
      target_ec_min: crop.target_ec_min,
      target_ec_max: crop.target_ec_max,
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

  const updateCropDraft = (key: keyof CropDraft, value: string) => {
    setCropDraft((current) => {
      if (!current) return current
      return {
        ...current,
        [key]: key === 'name' ? value : Number(value),
      }
    })
  }

  const saveCrop = async () => {
    if (!cropDraft || !cropDraft.name.trim()) return
    if (
      cropDraft.target_ph_min >= cropDraft.target_ph_max ||
      cropDraft.target_ec_min >= cropDraft.target_ec_max
    ) {
      return
    }

    const normalized = { ...cropDraft, name: cropDraft.name.trim() }
    if (editingCropId) {
      await db.crops.update(editingCropId, normalized)
    } else {
      const id = await db.crops.add(normalized)
      onReservoirCropsChange([...reservoirCropIds, id])
    }
    setCropDraft(null)
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

  return (
    <div className="screen">
      <ScreenHeader title="Settings" />

      <section className="settings-section">
        <h2>Crops in this reservoir</h2>
        <p className="settings-helper">
          Select once. Every daily reading applies to all selected crops.
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

      {cropDraft ? (
        <Modal
          title={editingCropId ? 'Edit crop' : 'Add custom crop'}
          onClose={() => setCropDraft(null)}
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
