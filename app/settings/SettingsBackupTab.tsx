'use client'

import { useState } from 'react'
import { CheckCircle, Loader2, Download, AlertTriangle, Database, FolderOpen, RotateCcw } from 'lucide-react'

type BackupStatus = 'idle' | 'running' | 'done' | 'error'
type RestoreStatus = 'idle' | 'running' | 'done' | 'error'

interface Props {
  lastBackup: string | null
  onBackupDone: (ts: string) => void
  initialBackupPath?: string
}

export default function SettingsBackupTab({ lastBackup, onBackupDone, initialBackupPath }: Props) {
  const [backupPath, setBackupPath] = useState(initialBackupPath ?? '')
  const [backupStatus, setBackupStatus] = useState<BackupStatus>('idle')
  const [backupError, setBackupError] = useState('')
  const [restoreFile, setRestoreFile] = useState<File | null>(null)
  const [restoreStatus, setRestoreStatus] = useState<RestoreStatus>('idle')
  const [restoreConfirming, setRestoreConfirming] = useState(false)

  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-zinc-50">Backup & Export</h2>
        <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">Download a copy of your data or restore from a previous backup.</p>
      </div>

      {lastBackup && (
        <p className="text-xs text-gray-400 dark:text-zinc-500">
          Last backup: {new Date(lastBackup).toLocaleString()}
        </p>
      )}

      <div className="flex gap-2">
        <a
          href="/api/backup/export"
          download
          onClick={() => onBackupDone(new Date().toISOString())}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 text-sm font-medium text-gray-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
        >
          <Download size={13} /> Export JSON
        </a>
        <a
          href="/api/backup/export-db"
          download
          onClick={() => onBackupDone(new Date().toISOString())}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 text-sm font-medium text-gray-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
        >
          <Database size={13} /> Export DB
        </a>
      </div>
      <p className="text-[11px] text-gray-400 dark:text-zinc-500">JSON export includes all records. DB export is the raw SQLite file that can restore everything.</p>

      <div className="space-y-2">
        <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300">Auto-backup folder</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={backupPath}
            onChange={e => setBackupPath(e.target.value)}
            placeholder="/Volumes/MyDrive/Backups"
            className="flex-1 border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
          />
          <button
            type="button"
            disabled={!backupPath.trim() || backupStatus === 'running'}
            onClick={async () => {
              setBackupStatus('running')
              setBackupError('')
              try {
                const res = await fetch('/api/backup/path', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ path: backupPath }),
                })
                const d = await res.json() as { ok?: boolean; error?: string }
                if (d.ok) {
                  const ts = new Date().toISOString()
                  setBackupStatus('done')
                  onBackupDone(ts)
                  setTimeout(() => setBackupStatus('idle'), 3000)
                } else {
                  setBackupStatus('error')
                  setBackupError(d.error ?? 'Backup failed')
                }
              } catch (e) {
                setBackupStatus('error')
                setBackupError(String(e))
              }
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {backupStatus === 'running' ? <Loader2 size={13} className="animate-spin" /> : backupStatus === 'done' ? <CheckCircle size={13} className="text-green-500" /> : <FolderOpen size={13} />}
            {backupStatus === 'running' ? 'Backing up…' : backupStatus === 'done' ? 'Done' : 'Back up now'}
          </button>
        </div>
        {backupStatus === 'error' && <p className="text-xs text-red-600">{backupError}</p>}
        <p className="text-[11px] text-gray-400 dark:text-zinc-500">Copies the database and all uploaded files to this path. Useful for external drives.</p>
      </div>

      <div className="space-y-2 pt-1 border-t border-gray-100 dark:border-zinc-800">
        <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 pt-2">Restore from backup</label>
        <p className="text-[11px] text-gray-400 dark:text-zinc-500">Upload a <code className="font-mono">.db</code> file to restore all data. Current data will be overwritten.</p>
        <input
          type="file"
          accept=".db"
          onChange={e => { setRestoreFile(e.target.files?.[0] ?? null); setRestoreConfirming(false); setRestoreStatus('idle') }}
          className="block text-xs text-gray-500 dark:text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-gray-200 dark:file:border-zinc-700 file:text-xs file:font-medium file:text-gray-700 dark:file:text-zinc-200 file:bg-white dark:file:bg-zinc-800 hover:file:bg-gray-50 dark:hover:file:bg-zinc-700 file:cursor-pointer"
        />
        {restoreFile && !restoreConfirming && restoreStatus === 'idle' && (
          <button
            type="button"
            onClick={() => setRestoreConfirming(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 text-sm font-medium hover:bg-amber-100 transition-colors"
          >
            <RotateCcw size={13} /> Restore {restoreFile.name}
          </button>
        )}
        {restoreConfirming && restoreStatus === 'idle' && (
          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-lg p-3 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle size={14} className="text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-300">This will <strong>overwrite all current data</strong>. The page will reload after restore. This cannot be undone unless you have a separate backup.</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setRestoreConfirming(false)}
                className="flex-1 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-200 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!restoreFile) return
                  setRestoreStatus('running')
                  setRestoreConfirming(false)
                  try {
                    const form = new FormData()
                    form.append('file', restoreFile)
                    const res = await fetch('/api/backup/restore', { method: 'POST', body: form })
                    const d = await res.json() as { ok?: boolean; reload?: boolean; error?: string }
                    if (d.ok) {
                      setRestoreStatus('done')
                      if (d.reload) setTimeout(() => window.location.reload(), 1200)
                    } else {
                      setRestoreStatus('error')
                      setBackupError(d.error ?? 'Restore failed')
                    }
                  } catch (e) {
                    setRestoreStatus('error')
                    setBackupError(String(e))
                  }
                }}
                className="flex-1 bg-amber-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors flex items-center justify-center gap-1.5"
              >
                <RotateCcw size={12} /> Yes, restore
              </button>
            </div>
          </div>
        )}
        {restoreStatus === 'running' && (
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-zinc-400">
            <Loader2 size={13} className="animate-spin" /> Restoring…
          </div>
        )}
        {restoreStatus === 'done' && (
          <div className="flex items-center gap-2 text-xs text-green-600">
            <CheckCircle size={13} /> Restored — reloading…
          </div>
        )}
        {restoreStatus === 'error' && (
          <p className="text-xs text-red-600">{backupError}</p>
        )}
      </div>
    </div>
  )
}
