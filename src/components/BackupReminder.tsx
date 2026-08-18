import { useState } from 'react'
import { Download, ShieldCheck } from 'lucide-react'
import {
  backupFileName,
  createReservoirBackup,
  savePreparedExport,
  type PreparedExport,
} from '../lib/backup'
import { Modal } from './Modal'

interface BackupReminderProps {
  reservoirCropIds: number[]
  onBackupCompleted: (timestamp: number) => void
}

export function BackupReminder({
  reservoirCropIds,
  onBackupCompleted,
}: BackupReminderProps) {
  const [preparedExport, setPreparedExport] = useState<PreparedExport | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const prepareBackup = async () => {
    setBusy(true)
    setError(null)
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
      setError(reason instanceof Error ? reason.message : 'Could not prepare backup.')
    } finally {
      setBusy(false)
    }
  }

  const saveBackup = async () => {
    if (!preparedExport) return
    setBusy(true)
    setError(null)
    try {
      const result = await savePreparedExport(preparedExport)
      if (result === 'cancelled') return

      onBackupCompleted(Date.now())
      setPreparedExport(null)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Could not save backup.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <aside className="backup-reminder" aria-labelledby="backup-reminder-title">
        <div className="backup-reminder__icon">
          <ShieldCheck size={23} aria-hidden="true" />
        </div>
        <div>
          <strong id="backup-reminder-title">Weekly backup due</strong>
          <p>Save a full copy to Files or iCloud Drive.</p>
        </div>
        <button type="button" disabled={busy} onClick={prepareBackup}>
          Back up now
        </button>
        {error ? <p className="data-error backup-reminder__error" role="alert">{error}</p> : null}
      </aside>

      {preparedExport ? (
        <Modal title="Weekly backup ready" onClose={() => setPreparedExport(null)}>
          <div className="backup-ready">
            <ShieldCheck size={34} aria-hidden="true" />
            <p>
              <strong>{preparedExport.fileName}</strong>
              Choose Save or share, then store the file in Files, iCloud Drive,
              or another location you control.
            </p>
          </div>
          <button
            type="button"
            className="primary-button"
            disabled={busy}
            onClick={saveBackup}
          >
            <Download size={19} aria-hidden="true" /> Save or share backup
          </button>
        </Modal>
      ) : null}
    </>
  )
}
