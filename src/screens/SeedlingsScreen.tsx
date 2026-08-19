import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Minus,
  Plus,
  Sprout,
  Trash2,
  XCircle,
} from 'lucide-react'
import { Modal } from '../components/Modal'
import { PropagationCare } from '../components/PropagationCare'
import { ScreenHeader } from '../components/ScreenHeader'
import { db, type SeedlingBatch } from '../db/database'
import {
  formatReadingDateTime,
  parseLocalDateTimeInput,
  toLocalDateTimeInput,
} from '../lib/dates'
import {
  deriveSeedlingStage,
  germinationRate,
  getBatchDay,
  getNextSeedlingAction,
  getPropagationDefaults,
  getReadinessCriteria,
  isReadyForTransfer,
  suggestedTrueLeaves,
} from '../lib/seedlings'
import { deleteSeedlingBatch } from '../lib/deletion'

type SeedlingView = 'active' | 'ready' | 'history'

interface NewBatchDraft {
  cropId: number
  cultivar: string
  quantitySown: number
  plugMedium: string
  sownAt: string
  targetTrueLeaves: number
}

interface TransferDraft {
  count: number
  channelName: string
  rootContactConfirmed: boolean
}

const PLUG_MEDIA = ['Rockwool', 'Foam plug', 'Peat/coir plug', 'Other']

function statusLabel(status: SeedlingBatch['status']): string {
  if (status === 'ready') return 'Ready for NFT'
  return `${status.charAt(0).toUpperCase()}${status.slice(1)}`
}

function stageClass(status: SeedlingBatch['status']): string {
  if (status === 'ready' || status === 'transferred') return 'complete'
  if (status === 'discarded') return 'discarded'
  return 'active'
}

function displayedBatchDay(batch: SeedlingBatch): number {
  const endTimestamp = batch.status === 'transferred'
    ? batch.transferred_at
    : batch.status === 'discarded'
      ? batch.updated_at
      : null
  return getBatchDay(batch.sown_at, endTimestamp ? new Date(endTimestamp) : new Date())
}

export default function SeedlingsScreen() {
  const crops = useLiveQuery(
    async () => (await db.crops.toArray()).toSorted((first, second) =>
      first.name.localeCompare(second.name),
    ),
    [],
    [],
  )
  const batches = useLiveQuery(
    () => db.seedling_batches.orderBy('sown_at').reverse().toArray(),
    [],
    [],
  )
  const [view, setView] = useState<SeedlingView>('active')
  const [newBatch, setNewBatch] = useState<NewBatchDraft | null>(null)
  const [editingBatch, setEditingBatch] = useState<SeedlingBatch | null>(null)
  const [transferDraft, setTransferDraft] = useState<TransferDraft | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const cropMap = useMemo(
    () => new Map(crops.map((crop) => [crop.id, crop.name])),
    [crops],
  )

  const visibleBatches = useMemo(() => {
    if (view === 'ready') return batches.filter((batch) => batch.status === 'ready')
    if (view === 'history') {
      return batches.filter(
        (batch) => batch.status === 'transferred' || batch.status === 'discarded',
      )
    }
    return batches.filter(
      (batch) => batch.status !== 'ready'
        && batch.status !== 'transferred'
        && batch.status !== 'discarded',
    )
  }, [batches, view])

  const growingCount = batches.filter(
    (batch) => batch.status !== 'ready'
      && batch.status !== 'transferred'
      && batch.status !== 'discarded',
  ).length
  const readyCount = batches.filter((batch) => batch.status === 'ready').length

  const openNewBatch = () => {
    const crop = crops[0]
    if (!crop) return
    setMessage(null)
    setNewBatch({
      cropId: crop.id,
      cultivar: '',
      quantitySown: 12,
      plugMedium: 'Rockwool',
      sownAt: toLocalDateTimeInput(),
      targetTrueLeaves: suggestedTrueLeaves(crop.name),
    })
  }

  const changeNewBatchCrop = (cropId: number) => {
    const cropName = cropMap.get(cropId) ?? ''
    setNewBatch((current) => current ? {
      ...current,
      cropId,
      targetTrueLeaves: suggestedTrueLeaves(cropName),
    } : null)
  }

  const saveNewBatch = async () => {
    if (!newBatch) return
    const sownAt = parseLocalDateTimeInput(newBatch.sownAt)
    if (
      sownAt === null
      || newBatch.quantitySown < 1
      || newBatch.targetTrueLeaves < 1
      || !cropMap.has(newBatch.cropId)
    ) return

    const now = Date.now()
    const propagation = getPropagationDefaults(cropMap.get(newBatch.cropId) ?? '')
    await db.seedling_batches.add({
      crop_id: newBatch.cropId,
      cultivar: newBatch.cultivar.trim(),
      quantity_sown: Math.round(newBatch.quantitySown),
      plug_medium: newBatch.plugMedium,
      sown_at: sownAt,
      emerged_at: null,
      germinated_count: 0,
      true_leaf_count: 0,
      target_true_leaves: Math.round(newBatch.targetTrueLeaves),
      roots_visible: false,
      plug_stable: false,
      healthy: false,
      propagation_ph_min: propagation.phMin,
      propagation_ph_max: propagation.phMax,
      propagation_ec_target: propagation.ecTarget,
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
      updated_at: now,
    })
    setNewBatch(null)
    setView('active')
    setMessage('Seedling batch started.')
  }

  const saveProgress = async () => {
    if (!editingBatch) return
    const normalized: SeedlingBatch = {
      ...editingBatch,
      germinated_count: Math.min(
        editingBatch.quantity_sown,
        Math.max(0, Math.round(editingBatch.germinated_count)),
      ),
      true_leaf_count: Math.max(0, Math.round(editingBatch.true_leaf_count)),
      target_true_leaves: Math.max(1, Math.round(editingBatch.target_true_leaves)),
      notes: editingBatch.notes.trim(),
      updated_at: Date.now(),
    }
    normalized.status = deriveSeedlingStage(normalized, normalized.status)
    await db.seedling_batches.put(normalized)
    setEditingBatch(null)
    setMessage(normalized.status === 'ready'
      ? 'All readiness criteria are met.'
      : 'Seedling progress saved.')
  }

  const markEmerged = () => {
    setEditingBatch((current) => current ? {
      ...current,
      emerged_at: current.emerged_at ?? Date.now(),
      germinated_count: Math.max(1, current.germinated_count),
    } : null)
  }

  const openTransfer = () => {
    if (!editingBatch || !isReadyForTransfer(editingBatch)) return
    setTransferDraft({
      count: editingBatch.germinated_count || editingBatch.quantity_sown,
      channelName: '',
      rootContactConfirmed: false,
    })
  }

  const completeTransfer = async () => {
    if (!editingBatch || !transferDraft?.rootContactConfirmed) return
    const maximum = editingBatch.germinated_count || editingBatch.quantity_sown
    const count = Math.min(maximum, Math.max(1, Math.round(transferDraft.count)))
    await db.seedling_batches.put({
      ...editingBatch,
      status: 'transferred',
      transferred_at: Date.now(),
      transferred_count: count,
      channel_name: transferDraft.channelName.trim(),
      root_contact_confirmed: true,
      updated_at: Date.now(),
    })
    setTransferDraft(null)
    setEditingBatch(null)
    setView('history')
    setMessage(`${count} seedlings transferred to NFT.`)
  }

  const discardBatch = async () => {
    if (!editingBatch) return
    if (!window.confirm('Move this batch to history as discarded?')) return
    await db.seedling_batches.update(editingBatch.id, {
      status: 'discarded',
      updated_at: Date.now(),
    })
    setEditingBatch(null)
    setView('history')
    setMessage('Batch moved to history.')
  }

  const removeBatch = async () => {
    if (!editingBatch) return
    const cropName = cropMap.get(editingBatch.crop_id) ?? 'this crop'
    if (!window.confirm(
      `Permanently delete this ${cropName} seedling batch? This cannot be undone.`,
    )) return
    await deleteSeedlingBatch(editingBatch.id)
    setTransferDraft(null)
    setEditingBatch(null)
    setMessage('Seedling batch deleted.')
  }

  const editingCropName = editingBatch
    ? cropMap.get(editingBatch.crop_id) ?? 'Deleted crop'
    : ''
  const editingCriteria = editingBatch ? getReadinessCriteria(editingBatch) : []
  const editingReady = editingBatch ? isReadyForTransfer(editingBatch) : false
  const editingIsHistory = editingBatch?.status === 'transferred'
    || editingBatch?.status === 'discarded'

  return (
    <div className="screen seedlings-screen">
      <ScreenHeader
        title="Seedlings"
        subtitle={`${growingCount} growing · ${readyCount} ready`}
        action={(
          <button
            type="button"
            className="header-add-button"
            aria-label="Start seedling batch"
            disabled={!crops.length}
            onClick={openNewBatch}
          >
            <Plus size={23} aria-hidden="true" />
          </button>
        )}
      />

      <div className="segmented-control seedling-view-control" aria-label="Seedling batch view">
        {(['active', 'ready', 'history'] as const).map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={view === item}
            onClick={() => setView(item)}
          >
            {item === 'active' ? 'Active' : item === 'ready' ? `Ready (${readyCount})` : 'History'}
          </button>
        ))}
      </div>

      {message ? <p className="seedling-message" role="status">{message}</p> : null}

      {visibleBatches.length ? (
        <div className="seedling-batch-list">
          {visibleBatches.map((batch) => {
            const cropName = cropMap.get(batch.crop_id) ?? 'Deleted crop'
            return (
              <button
                key={batch.id}
                type="button"
                className="seedling-batch-card"
                onClick={() => {
                  setMessage(null)
                  setEditingBatch({ ...batch })
                }}
              >
                <span className={`seedling-stage-icon seedling-stage-icon--${stageClass(batch.status)}`}>
                  {batch.status === 'transferred' ? (
                    <Check size={21} aria-hidden="true" />
                  ) : batch.status === 'discarded' ? (
                    <XCircle size={21} aria-hidden="true" />
                  ) : (
                    <Sprout size={21} aria-hidden="true" />
                  )}
                </span>
                <span className="seedling-batch-card__content">
                  <span className="seedling-batch-card__topline">
                    <strong>{cropName}{batch.cultivar ? ` · ${batch.cultivar}` : ''}</strong>
                    <em>Day {displayedBatchDay(batch)}</em>
                  </span>
                  <small>{statusLabel(batch.status)} · {batch.germinated_count}/{batch.quantity_sown} germinated</small>
                  <span>{getNextSeedlingAction(batch)}</span>
                </span>
                <ChevronRight size={19} aria-hidden="true" />
              </button>
            )
          })}
        </div>
      ) : (
        <section className="seedling-empty">
          <Sprout size={38} strokeWidth={1.7} aria-hidden="true" />
          <h2>{view === 'active' ? 'No active batches' : view === 'ready' ? 'Nothing ready yet' : 'No batch history'}</h2>
          <p>
            {view === 'active'
              ? 'Start a batch to track emergence, true leaves, roots, and NFT readiness.'
              : view === 'ready'
                ? 'A batch appears here only after every readiness check is confirmed.'
                : 'Transferred and discarded batches will remain available here.'}
          </p>
          {view === 'active' ? (
            <button type="button" className="secondary-button" onClick={openNewBatch}>
              <Plus size={18} aria-hidden="true" /> Start batch
            </button>
          ) : null}
        </section>
      )}

      <aside className="seedling-guide-card">
        <strong>Deterministic guidance</strong>
        <p>
          Days are informational. Transfer readiness depends only on the recorded
          leaf, root, plug, and health checks.
        </p>
        <a
          href="https://ccd.uky.edu/sites/default/files/2026-02/ccd-cp-63_hydrolettuce-updated_accessible.pdf"
          target="_blank"
          rel="noreferrer"
        >
          Lettuce criteria source
        </a>
      </aside>

      {newBatch ? (
        <Modal title="Start seedling batch" onClose={() => setNewBatch(null)}>
          <div className="form-stack">
            <label>
              <span>Crop</span>
              <select
                value={newBatch.cropId}
                onChange={(event) => changeNewBatchCrop(Number(event.target.value))}
              >
                {crops.map((crop) => <option key={crop.id} value={crop.id}>{crop.name}</option>)}
              </select>
            </label>
            <label>
              <span>Cultivar (optional)</span>
              <input
                value={newBatch.cultivar}
                placeholder="e.g. Butterhead"
                onChange={(event) => setNewBatch({ ...newBatch, cultivar: event.target.value })}
              />
            </label>
            <div className="form-grid">
              <label>
                <span>Plugs sown</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  value={newBatch.quantitySown}
                  onChange={(event) => setNewBatch({ ...newBatch, quantitySown: Number(event.target.value) })}
                />
              </label>
              <label>
                <span>Plug medium</span>
                <select
                  value={newBatch.plugMedium}
                  onChange={(event) => setNewBatch({ ...newBatch, plugMedium: event.target.value })}
                >
                  {PLUG_MEDIA.map((medium) => <option key={medium}>{medium}</option>)}
                </select>
              </label>
            </div>
            <label>
              <span>Sowing time</span>
              <input
                type="datetime-local"
                value={newBatch.sownAt}
                onChange={(event) => setNewBatch({ ...newBatch, sownAt: event.target.value })}
              />
            </label>
            <label>
              <span>True leaves required for transfer</span>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                max="12"
                value={newBatch.targetTrueLeaves}
                onChange={(event) => setNewBatch({ ...newBatch, targetTrueLeaves: Number(event.target.value) })}
              />
              <small className="field-help">
                Lettuce defaults to 3 true leaves. Other crops use an editable starting rule.
              </small>
            </label>
          </div>
          <button type="button" className="primary-button" onClick={saveNewBatch}>
            Start batch
          </button>
        </Modal>
      ) : null}

      {editingBatch ? (
        <Modal
          title={`${editingCropName} · Day ${displayedBatchDay(editingBatch)}`}
          onClose={() => {
            setEditingBatch(null)
            setTransferDraft(null)
          }}
        >
          <div className="batch-detail-summary">
            <span className={`seedling-status seedling-status--${stageClass(editingBatch.status)}`}>
              {statusLabel(editingBatch.status)}
            </span>
            <small>Sown {formatReadingDateTime(editingBatch.sown_at)} · {editingBatch.plug_medium}</small>
            <strong>{germinationRate(editingBatch)}% germination</strong>
          </div>

          {editingIsHistory ? (
            <div className="batch-history-detail">
              {editingBatch.status === 'transferred' ? (
                <>
                  <CheckCircle2 size={34} aria-hidden="true" />
                  <strong>{editingBatch.transferred_count} seedlings transferred</strong>
                  <p>
                    {editingBatch.transferred_at ? formatReadingDateTime(editingBatch.transferred_at) : ''}
                    {editingBatch.channel_name ? ` · ${editingBatch.channel_name}` : ''}
                  </p>
                  <small>Root or wick contact with the nutrient film was confirmed.</small>
                </>
              ) : (
                <>
                  <XCircle size={34} aria-hidden="true" />
                  <strong>Batch discarded</strong>
                </>
              )}
              {editingBatch.notes ? <p className="batch-history-notes">{editingBatch.notes}</p> : null}
              <button type="button" className="delete-record-button" onClick={removeBatch}>
                <Trash2 size={18} aria-hidden="true" /> Delete batch permanently
              </button>
            </div>
          ) : transferDraft ? (
            <div className="transfer-form">
              <h3>Transfer to NFT</h3>
              <p>Record the actual transfer. This closes the seedling batch and keeps it in history.</p>
              <div className="form-stack">
                <label>
                  <span>Seedlings transferred</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max={editingBatch.germinated_count || editingBatch.quantity_sown}
                    value={transferDraft.count}
                    onChange={(event) => setTransferDraft({ ...transferDraft, count: Number(event.target.value) })}
                  />
                </label>
                <label>
                  <span>Channel name (optional)</span>
                  <input
                    value={transferDraft.channelName}
                    placeholder="e.g. NFT A"
                    onChange={(event) => setTransferDraft({ ...transferDraft, channelName: event.target.value })}
                  />
                </label>
                <label className="readiness-check readiness-check--important">
                  <input
                    type="checkbox"
                    checked={transferDraft.rootContactConfirmed}
                    onChange={(event) => setTransferDraft({ ...transferDraft, rootContactConfirmed: event.target.checked })}
                  />
                  <span>
                    <strong>Root or wick reaches the nutrient film</strong>
                    <small>Required before completing the transfer.</small>
                  </span>
                </label>
              </div>
              <button
                type="button"
                className="primary-button"
                disabled={!transferDraft.rootContactConfirmed || transferDraft.count < 1}
                onClick={completeTransfer}
              >
                Complete transfer
              </button>
              <button type="button" className="outline-button" onClick={() => setTransferDraft(null)}>
                Back to checks
              </button>
            </div>
          ) : (
            <>
              <section className="progress-section">
                <div className="section-heading-row">
                  <h3>Germination</h3>
                  {editingBatch.emerged_at === null ? (
                    <button type="button" className="text-button" onClick={markEmerged}>
                      <Check size={17} aria-hidden="true" /> Mark emerged
                    </button>
                  ) : null}
                </div>
                {editingBatch.emerged_at !== null ? (
                  <div className="form-stack">
                    <label>
                      <span>Emergence time</span>
                      <input
                        type="datetime-local"
                        value={toLocalDateTimeInput(new Date(editingBatch.emerged_at))}
                        onChange={(event) => setEditingBatch({
                          ...editingBatch,
                          emerged_at: parseLocalDateTimeInput(event.target.value),
                        })}
                      />
                    </label>
                    <label>
                      <span>Plugs germinated (of {editingBatch.quantity_sown})</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        max={editingBatch.quantity_sown}
                        value={editingBatch.germinated_count}
                        onChange={(event) => setEditingBatch({ ...editingBatch, germinated_count: Number(event.target.value) })}
                      />
                    </label>
                  </div>
                ) : (
                  <p className="progress-placeholder">Keep plugs evenly moist, not flooded. Record emergence when seedlings are visible.</p>
                )}
              </section>

              <PropagationCare
                batch={editingBatch}
                cropName={editingCropName}
                onChange={setEditingBatch}
              />

              <section className="progress-section">
                <h3>Transfer readiness</h3>
                <div className="leaf-stepper">
                  <span><strong>True leaves</strong><small>Do not count seed leaves</small></span>
                  <button
                    type="button"
                    aria-label="Decrease true leaf count"
                    onClick={() => setEditingBatch({ ...editingBatch, true_leaf_count: Math.max(0, editingBatch.true_leaf_count - 1) })}
                  >
                    <Minus size={21} aria-hidden="true" />
                  </button>
                  <strong>{editingBatch.true_leaf_count}</strong>
                  <button
                    type="button"
                    aria-label="Increase true leaf count"
                    onClick={() => setEditingBatch({ ...editingBatch, true_leaf_count: editingBatch.true_leaf_count + 1 })}
                  >
                    <Plus size={21} aria-hidden="true" />
                  </button>
                </div>
                <label className="target-leaves-field">
                  Required for this batch
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="12"
                    value={editingBatch.target_true_leaves}
                    onChange={(event) => setEditingBatch({ ...editingBatch, target_true_leaves: Number(event.target.value) })}
                  />
                </label>
                <div className="readiness-list">
                  {editingCriteria.map((criterion) => {
                    if (criterion.id === 'emerged' || criterion.id === 'leaves') {
                      return (
                        <div key={criterion.id} className="readiness-check readiness-check--display">
                          {criterion.met ? <CheckCircle2 size={22} /> : <Circle size={22} />}
                          <span><strong>{criterion.label}</strong></span>
                        </div>
                      )
                    }
                    const key = criterion.id === 'roots'
                      ? 'roots_visible'
                      : criterion.id === 'plug'
                        ? 'plug_stable'
                        : 'healthy'
                    return (
                      <label key={criterion.id} className="readiness-check">
                        <input
                          type="checkbox"
                          checked={editingBatch[key]}
                          onChange={(event) => setEditingBatch({ ...editingBatch, [key]: event.target.checked })}
                        />
                        <span><strong>{criterion.label}</strong></span>
                      </label>
                    )
                  })}
                </div>
              </section>

              <label className="field-label batch-notes">
                Notes
                <textarea
                  className="notes-field"
                  value={editingBatch.notes}
                  placeholder="Optional observations"
                  onChange={(event) => setEditingBatch({ ...editingBatch, notes: event.target.value })}
                />
              </label>

              {editingReady ? (
                <div className="ready-callout">
                  <CheckCircle2 size={25} aria-hidden="true" />
                  <div><strong>Readiness criteria met</strong><small>Save progress, or transfer this batch now.</small></div>
                </div>
              ) : null}

              <button type="button" className="primary-button" onClick={saveProgress}>
                Save progress
              </button>
              {editingReady ? (
                <button type="button" className="outline-button" onClick={openTransfer}>
                  Transfer to NFT
                </button>
              ) : null}
              <button type="button" className="discard-batch-button" onClick={discardBatch}>
                Mark batch discarded
              </button>
              <button type="button" className="delete-record-button" onClick={removeBatch}>
                <Trash2 size={18} aria-hidden="true" /> Delete batch permanently
              </button>
            </>
          )}
        </Modal>
      ) : null}
    </div>
  )
}
