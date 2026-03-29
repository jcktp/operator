'use client'

import { useState, useRef } from 'react'
import { X, Upload, Check, Loader2, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { parseVCard, parseCsv, type ParsedContact } from './parseContacts'

interface Props {
  areas: string[]
  onClose: () => void
  onImported: () => void
}

type FileType = 'vcf' | 'csv'

interface ImportRow extends ParsedContact {
  selected: boolean
}

export default function ContactImporter({ areas, onClose, onImported }: Props) {
  const [fileType, setFileType] = useState<FileType>('vcf')
  const [rows, setRows] = useState<ImportRow[]>([])
  const [defaultArea, setDefaultArea] = useState(areas[0] ?? '')
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File) => {
    setError('')
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      try {
        const contacts = fileType === 'vcf' ? parseVCard(text) : parseCsv(text)
        if (contacts.length === 0) { setError('No contacts found in file.'); return }
        setRows(contacts.map(c => ({ ...c, area: defaultArea, selected: true })))
      } catch {
        setError('Could not parse file. Check the format and try again.')
      }
    }
    reader.readAsText(file)
  }

  const toggle = (i: number) => setRows(r => r.map((row, idx) => idx === i ? { ...row, selected: !row.selected } : row))
  const setArea = (i: number, area: string) => setRows(r => r.map((row, idx) => idx === i ? { ...row, area } : row))
  const applyDefaultArea = (area: string) => {
    setDefaultArea(area)
    setRows(r => r.map(row => ({ ...row, area })))
  }

  const selectedCount = rows.filter(r => r.selected).length

  const handleImport = async () => {
    const toImport = rows.filter(r => r.selected && r.name.trim())
    if (!toImport.length) return
    setImporting(true)
    try {
      await Promise.all(toImport.map(c =>
        fetch('/api/directs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: c.name, title: c.title || 'N/A', email: c.email, phone: c.phone, area: c.area || defaultArea }),
        })
      ))
      setDone(true)
      setTimeout(() => { onImported(); onClose() }, 800)
    } catch {
      setError('Import failed — please try again.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-zinc-50">Import contacts</h2>
            <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">From a vCard (.vcf) or CSV file</p>
          </div>
          <button onClick={onClose} className="text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Format toggle */}
          {rows.length === 0 && (
            <>
              <div className="flex bg-gray-100 dark:bg-zinc-800 rounded-lg p-1 gap-1">
                {(['vcf', 'csv'] as FileType[]).map(t => (
                  <button key={t} type="button" onClick={() => setFileType(t)}
                    className={cn('flex-1 py-1.5 rounded-md text-xs font-medium transition-colors',
                      fileType === t ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-zinc-50 shadow-sm' : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200'
                    )}>
                    {t === 'vcf' ? 'vCard (.vcf)' : 'CSV'}
                  </button>
                ))}
              </div>

              <div className="bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl p-4 text-xs text-gray-500 dark:text-zinc-400 space-y-1.5">
                {fileType === 'vcf' ? (
                  <>
                    <p className="font-medium text-gray-700 dark:text-zinc-200">Export a vCard from:</p>
                    <p>• <strong>Mac Contacts</strong> — select contacts → File → Export → Export vCard</p>
                    <p>• <strong>Google Contacts</strong> — google.com/contacts → Export → vCard</p>
                    <p>• <strong>iPhone</strong> — share a contact → select &quot;.vcf&quot;</p>
                    <p>• <strong>Outlook</strong> — contact card → Save as → vCard</p>
                  </>
                ) : (
                  <>
                    <p className="font-medium text-gray-700 dark:text-zinc-200">Export a CSV from:</p>
                    <p>• <strong>Google Contacts</strong> — google.com/contacts → Export → Google CSV</p>
                    <p>• <strong>Outlook</strong> — People → Manage → Export contacts → CSV</p>
                    <p>• <strong>Any spreadsheet</strong> — columns: Name, Title, Email, Phone</p>
                  </>
                )}
              </div>

              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-gray-200 dark:border-zinc-700 rounded-xl p-8 text-center cursor-pointer hover:border-gray-300 dark:hover:border-zinc-500 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
              >
                <Upload size={20} className="text-gray-300 dark:text-zinc-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600 dark:text-zinc-300 font-medium">Click to select file</p>
                <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">{fileType === 'vcf' ? '.vcf' : '.csv, .txt'}</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept={fileType === 'vcf' ? '.vcf' : '.csv,.txt'}
                  className="hidden"
                  onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
                />
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}
            </>
          )}

          {/* Preview */}
          {rows.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 dark:text-zinc-400">{rows.length} contacts found — {selectedCount} selected</p>
                <button type="button" onClick={() => setRows([])} className="text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300">
                  Change file
                </button>
              </div>

              {/* Default area */}
              <div className="flex items-center gap-3 bg-gray-50 dark:bg-zinc-800 rounded-lg px-3 py-2.5">
                <span className="text-xs text-gray-500 dark:text-zinc-400 shrink-0">Apply area to all:</span>
                <AreaSelect value={defaultArea} options={areas} onChange={applyDefaultArea} />
              </div>

              <div className="border border-gray-200 dark:border-zinc-700 rounded-xl divide-y divide-gray-100 dark:divide-zinc-800 overflow-hidden">
                {rows.map((row, i) => (
                  <div key={i} className={cn('flex items-start gap-3 px-4 py-3 transition-colors', !row.selected && 'opacity-40')}>
                    <button type="button" onClick={() => toggle(i)}
                      className={cn('mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                        row.selected ? 'bg-gray-900 dark:bg-zinc-100 border-gray-900 dark:border-zinc-100' : 'border-gray-300 dark:border-zinc-600'
                      )}>
                      {row.selected && <Check size={10} className="text-white" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900 dark:text-zinc-50">{row.name}</span>
                        {row.title && <span className="text-xs text-gray-400 dark:text-zinc-500">{row.title}</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {row.email && <span className="text-xs text-gray-400 dark:text-zinc-500">{row.email}</span>}
                        {row.phone && <span className="text-xs text-gray-400 dark:text-zinc-500">{row.phone}</span>}
                      </div>
                    </div>
                    <div className="shrink-0 w-36">
                      <AreaSelect value={row.area} options={areas} onChange={v => setArea(i, v)} />
                    </div>
                  </div>
                ))}
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}
            </>
          )}
        </div>

        {/* Footer */}
        {rows.length > 0 && (
          <div className="px-5 py-4 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between gap-3">
            <button type="button" onClick={onClose} className="text-sm text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={selectedCount === 0 || importing || done}
              className="flex items-center gap-2 bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors"
            >
              {done ? (
                <><Check size={13} /> Imported</>
              ) : importing ? (
                <><Loader2 size={13} className="animate-spin" /> Importing…</>
              ) : (
                `Import ${selectedCount} contact${selectedCount !== 1 ? 's' : ''}`
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function AreaSelect({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="relative w-full">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full appearance-none bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg pl-2.5 pr-6 py-1.5 text-xs text-gray-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-zinc-400"
      >
        {!value && <option value="">Select area…</option>}
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500 pointer-events-none" />
    </div>
  )
}
