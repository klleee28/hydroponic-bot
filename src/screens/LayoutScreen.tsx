import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Grid2X2, History, Leaf, MapPin, Plus, Trash2 } from 'lucide-react'
import { Modal } from '../components/Modal'
import { ScreenHeader } from '../components/ScreenHeader'
import { db, type GrowArea, type GrowAreaType, type GrowPosition } from '../db/database'
import { formatReadingDateTime } from '../lib/dates'
import {
  areaTypeLabel,
  assignGrowPosition,
  clearGrowPosition,
  createGrowArea,
  deleteGrowArea,
  elapsedDays,
  isPositionOccupied,
} from '../lib/layout'

interface AreaDraft {
  name: string
  type: GrowAreaType
  rows: number
  columns: number
}

function batchLabel(cropName: string, cultivar: string): string {
  return `${cropName}${cultivar ? ` · ${cultivar}` : ''} seedling batch`
}

export default function LayoutScreen() {
  const areas = useLiveQuery(
    () => db.grow_areas.orderBy('updated_at').reverse().toArray(),
    [],
    [],
  )
  const positions = useLiveQuery(() => db.grow_positions.toArray(), [], [])
  const crops = useLiveQuery(() => db.crops.toArray(), [], [])
  const batches = useLiveQuery(() => db.seedling_batches.toArray(), [], [])
  const activity = useLiveQuery(
    () => db.layout_activity.orderBy('timestamp').reverse().limit(12).toArray(),
    [],
    [],
  )
  const [draft, setDraft] = useState<AreaDraft | null>(null)
  const [openedArea, setOpenedArea] = useState<GrowArea | null>(null)
  const [editingPosition, setEditingPosition] = useState<GrowPosition | null>(null)
  const [assignment, setAssignment] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const cropMap = useMemo(
    () => new Map(crops.map((crop) => [crop.id, crop.name])),
    [crops],
  )
  const batchMap = useMemo(
    () => new Map(batches.map((batch) => [batch.id, batch])),
    [batches],
  )
  const positionsByArea = useMemo(() => {
    const result = new Map<number, GrowPosition[]>()
    for (const position of positions) {
      const current = result.get(position.area_id) ?? []
      current.push(position)
      result.set(position.area_id, current)
    }
    for (const current of result.values()) {
      current.sort((first, second) => first.row - second.row || first.column - second.column)
    }
    return result
  }, [positions])
  const occupiedCount = positions.filter(isPositionOccupied).length
  const emptyCount = positions.length - occupiedCount
  const activeBatches = batches.filter((batch) =>
    batch.status !== 'transferred' && batch.status !== 'discarded',
  )
  const areaPositions = openedArea ? positionsByArea.get(openedArea.id) ?? [] : []

  const itemLabel = (position: GrowPosition): string => {
    if (position.crop_id !== null) return cropMap.get(position.crop_id) ?? 'Deleted crop'
    if (position.seedling_batch_id !== null) {
      const batch = batchMap.get(position.seedling_batch_id)
      return batch ? batchLabel(cropMap.get(batch.crop_id) ?? 'Deleted crop', batch.cultivar) : 'Deleted batch'
    }
    return 'Empty'
  }

  const itemAge = (position: GrowPosition): string | null => {
    const batchStart = position.seedling_batch_id === null
      ? null
      : batchMap.get(position.seedling_batch_id)?.sown_at ?? null
    const days = elapsedDays(batchStart ?? position.assigned_at, now)
    return days === null ? null : `Day ${days}`
  }

  const openNewArea = () => {
    setError(null)
    setDraft({ name: '', type: 'nft-channel', rows: 1, columns: 12 })
  }

  const saveArea = async () => {
    if (!draft) return
    try {
      const areaId = await createGrowArea(draft)
      const created = await db.grow_areas.get(areaId)
      if (created) setOpenedArea(created)
      setDraft(null)
      setMessage('Layout created. Tap a position to record what is there.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create this layout.')
    }
  }

  const openPosition = (position: GrowPosition) => {
    setError(null)
    setAssignment('')
    setEditingPosition(position)
  }

  const saveAssignment = async () => {
    if (!editingPosition || !assignment) return
    const [kind, idText] = assignment.split(':')
    const id = Number(idText)
    try {
      await assignGrowPosition(kind === 'crop'
        ? { positionId: editingPosition.id, cropId: id }
        : { positionId: editingPosition.id, seedlingBatchId: id })
      setEditingPosition(null)
      setAssignment('')
      setMessage(`${openedArea?.name ?? 'Layout'} position recorded.`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not record this position.')
    }
  }

  const clearPosition = async () => {
    if (!editingPosition) return
    if (!window.confirm(`Clear ${editingPosition.position_code}? This keeps its layout history.`)) return
    await clearGrowPosition(editingPosition.id)
    setEditingPosition(null)
    setMessage('Position cleared; the movement record was kept.')
  }

  const removeArea = async () => {
    if (!openedArea) return
    if (!window.confirm(`Delete ${openedArea.name} and its current positions? Layout history will remain.`)) return
    await deleteGrowArea(openedArea.id)
    setEditingPosition(null)
    setOpenedArea(null)
    setMessage('Layout deleted. Its history remains in recent activity.')
  }

  return (
    <div className="screen layout-screen">
      <ScreenHeader
        title="Grow layout"
        subtitle={`${occupiedCount} placed · ${emptyCount} empty`}
        action={(
          <button type="button" className="header-add-button" aria-label="Add grow layout" onClick={openNewArea}>
            <Plus size={23} aria-hidden="true" />
          </button>
        )}
      />

      {message ? <p className="layout-message" role="status">{message}</p> : null}

      {areas.length ? (
        <div className="layout-area-list">
          {areas.map((area) => {
            const areaSlots = positionsByArea.get(area.id) ?? []
            const areaOccupied = areaSlots.filter(isPositionOccupied).length
            return (
              <button
                key={area.id}
                type="button"
                className="layout-area-card"
                onClick={() => {
                  setOpenedArea(area)
                  setEditingPosition(null)
                  setError(null)
                }}
              >
                <span className="layout-area-card__icon">
                  {area.type === 'nft-channel' ? <MapPin size={22} /> : <Grid2X2 size={22} />}
                </span>
                <span className="layout-area-card__content">
                  <strong>{area.name}</strong>
                  <small>{areaTypeLabel(area.type)} · {area.rows} × {area.columns}</small>
                  <span>{areaOccupied} occupied · {areaSlots.length - areaOccupied} empty</span>
                </span>
                <span className="layout-area-card__preview" aria-hidden="true">
                  {areaSlots.slice(0, 8).map((position) => (
                    <i key={position.id} className={isPositionOccupied(position) ? 'is-occupied' : ''} />
                  ))}
                </span>
              </button>
            )
          })}
        </div>
      ) : (
        <section className="layout-empty">
          <Grid2X2 size={38} strokeWidth={1.7} aria-hidden="true" />
          <h2>No layout yet</h2>
          <p>Add an NFT channel, seedling tray, or simple grid. Every slot is numbered and stored offline.</p>
          <button type="button" className="secondary-button" onClick={openNewArea}>
            <Plus size={18} aria-hidden="true" /> Add layout
          </button>
        </section>
      )}

      <section className="layout-activity" aria-labelledby="layout-activity-title">
        <div className="section-heading-row">
          <h2 id="layout-activity-title"><History size={18} aria-hidden="true" /> Recent layout activity</h2>
        </div>
        {activity.length ? (
          <div className="layout-activity-list">
            {activity.map((item) => (
              <div key={item.id} className="layout-activity-row">
                <span className={item.action === 'assigned' ? 'layout-activity-row__icon is-assigned' : 'layout-activity-row__icon'}>
                  {item.action === 'assigned' ? <Leaf size={16} /> : <MapPin size={16} />}
                </span>
                <span>
                  <strong>{item.action === 'assigned' ? 'Placed' : 'Cleared'} {item.item_label}</strong>
                  <small>{item.area_name} · {item.position_code} · {formatReadingDateTime(item.timestamp)}</small>
                </span>
              </div>
            ))}
          </div>
        ) : <p className="layout-activity__empty">Position changes will be recorded here.</p>}
      </section>

      {draft ? (
        <Modal title="Add grow layout" onClose={() => setDraft(null)}>
          <div className="form-stack">
            <label>
              <span>Name</span>
              <input
                autoFocus
                value={draft.name}
                placeholder="e.g. NFT Channel A"
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </label>
            <label>
              <span>Layout type</span>
              <select
                value={draft.type}
                onChange={(event) => setDraft({ ...draft, type: event.target.value as GrowAreaType })}
              >
                <option value="nft-channel">NFT channel · numbered row</option>
                <option value="seedling-tray">Seedling tray · labelled grid</option>
                <option value="grid">Grow grid · labelled grid</option>
              </select>
            </label>
            <div className="form-grid">
              {draft.type !== 'nft-channel' ? (
                <label>
                  <span>Rows</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="24"
                    value={draft.rows}
                    onChange={(event) => setDraft({ ...draft, rows: Number(event.target.value) })}
                  />
                </label>
              ) : null}
              <label>
                <span>{draft.type === 'nft-channel' ? 'Plant holes' : 'Columns'}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="24"
                  value={draft.columns}
                  onChange={(event) => setDraft({ ...draft, columns: Number(event.target.value) })}
                />
              </label>
            </div>
            <p className="field-help">Each position represents one plant or one seedling-batch location.</p>
            {error ? <p className="modal-delete-error" role="alert">{error}</p> : null}
          </div>
          <button type="button" className="primary-button" onClick={saveArea}>Create layout</button>
        </Modal>
      ) : null}

      {openedArea ? (
        <Modal
          title={editingPosition ? `${openedArea.name} · ${editingPosition.position_code}` : openedArea.name}
          onClose={() => {
            setOpenedArea(null)
            setEditingPosition(null)
          }}
        >
          {editingPosition ? (
            <div className="layout-position-editor">
              <button type="button" className="text-button" onClick={() => setEditingPosition(null)}>← All positions</button>
              <div className={`layout-position-summary ${isPositionOccupied(editingPosition) ? 'is-occupied' : ''}`}>
                <span>{editingPosition.position_code}</span>
                <strong>{itemLabel(editingPosition)}</strong>
                {editingPosition.assigned_at ? <small>Recorded {formatReadingDateTime(editingPosition.assigned_at)}</small> : null}
              </div>
              {isPositionOccupied(editingPosition) ? (
                <button type="button" className="delete-record-button" onClick={clearPosition}>
                  <Trash2 size={18} aria-hidden="true" /> Clear position
                </button>
              ) : (
                <div className="form-stack">
                  <label>
                    <span>Place in this position</span>
                    <select value={assignment} onChange={(event) => setAssignment(event.target.value)}>
                      <option value="">Choose crop or seedling batch</option>
                      <optgroup label="Crops">
                        {crops.map((crop) => <option key={crop.id} value={`crop:${crop.id}`}>{crop.name}</option>)}
                      </optgroup>
                      {activeBatches.length ? (
                        <optgroup label="Active seedling batches">
                          {activeBatches.map((batch) => (
                            <option key={batch.id} value={`batch:${batch.id}`}>
                              {batchLabel(cropMap.get(batch.crop_id) ?? 'Deleted crop', batch.cultivar)}
                            </option>
                          ))}
                        </optgroup>
                      ) : null}
                    </select>
                  </label>
                  <p className="field-help">Assigning a batch records where it is currently located; it does not change its seedling status.</p>
                  {error ? <p className="modal-delete-error" role="alert">{error}</p> : null}
                  <button type="button" className="primary-button" disabled={!assignment} onClick={saveAssignment}>Record position</button>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="layout-area-summary">
                <span>{areaTypeLabel(openedArea.type)}</span>
                <strong>{areaPositions.filter(isPositionOccupied).length} of {areaPositions.length} positions occupied</strong>
              </div>
              <div className="position-grid-scroll">
                <div
                  className="position-grid"
                  style={{ gridTemplateColumns: `repeat(${openedArea.columns}, minmax(64px, 1fr))` }}
                >
                  {areaPositions.map((position) => (
                    <button
                      key={position.id}
                      type="button"
                      className={`position-cell ${isPositionOccupied(position) ? 'is-occupied' : ''}`}
                      onClick={() => openPosition(position)}
                    >
                      <small>{position.position_code}</small>
                      <strong>{isPositionOccupied(position) ? itemLabel(position) : 'Empty'}</strong>
                      {isPositionOccupied(position) && itemAge(position) ? <em>{itemAge(position)}</em> : null}
                    </button>
                  ))}
                </div>
              </div>
              <p className="field-help layout-grid-help">Tap a position to record or clear it. Clear actions keep their history.</p>
              <button type="button" className="delete-record-button" onClick={removeArea}>
                <Trash2 size={18} aria-hidden="true" /> Delete layout
              </button>
            </>
          )}
        </Modal>
      ) : null}
    </div>
  )
}
