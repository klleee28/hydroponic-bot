import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  CalendarCheck2,
  ChevronRight,
  Leaf,
  Pencil,
  Plus,
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

interface SettingsScreenProps {
  activeCropId: number
  onActiveCropChange: (id: number) => void
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
  activeCropId,
  onActiveCropChange,
}: SettingsScreenProps) {
  const crops = useLiveQuery(() => db.crops.toArray(), [], [])
  const tasks = useLiveQuery(() => db.tasks.toArray(), [], [])
  const activeCrop = crops.find((crop) => crop.id === activeCropId)
  const [cropDraft, setCropDraft] = useState<CropDraft | null>(null)
  const [editingCropId, setEditingCropId] = useState<number | null>(null)
  const [taskDraft, setTaskDraft] = useState({ title: '', interval_days: 14 })
  const [showTaskModal, setShowTaskModal] = useState(false)

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

  const openEditCrop = () => {
    if (!activeCrop) return
    setEditingCropId(activeCrop.id)
    setCropDraft({
      name: activeCrop.name,
      target_ph_min: activeCrop.target_ph_min,
      target_ph_max: activeCrop.target_ph_max,
      target_ec_min: activeCrop.target_ec_min,
      target_ec_max: activeCrop.target_ec_max,
    })
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
      onActiveCropChange(id)
    }
    setCropDraft(null)
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
        <h2>Active crop</h2>
        <label className="crop-selector">
          <Leaf size={27} color="#4a9b66" aria-hidden="true" />
          <span className="sr-only">Select active crop</span>
          <select
            value={activeCropId}
            onChange={(event) => onActiveCropChange(Number(event.target.value))}
          >
            {crops.map((crop) => (
              <option key={crop.id} value={crop.id}>
                {crop.name}
              </option>
            ))}
          </select>
          <ChevronRight size={20} aria-hidden="true" />
        </label>
      </section>

      <section className="settings-section">
        <div className="section-heading-row">
          <h2>Crop thresholds</h2>
          <button type="button" className="text-button" onClick={openEditCrop}>
            <Pencil size={17} aria-hidden="true" /> Edit
          </button>
        </div>
        <div className="settings-list">
          <div className="settings-row">
            <span>pH range</span>
            <strong>
              {activeCrop
                ? `${activeCrop.target_ph_min.toFixed(1)} – ${activeCrop.target_ph_max.toFixed(1)}`
                : '—'}
            </strong>
          </div>
          <div className="settings-row">
            <span>EC range (mS/cm)</span>
            <strong>
              {activeCrop
                ? `${activeCrop.target_ec_min.toFixed(1)} – ${activeCrop.target_ec_max.toFixed(1)}`
                : '—'}
            </strong>
          </div>
        </div>
        <button type="button" className="outline-button" onClick={openNewCrop}>
          <Plus size={20} aria-hidden="true" /> Add custom crop
        </button>
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
