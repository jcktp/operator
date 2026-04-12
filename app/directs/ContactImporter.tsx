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
 <div className="bg-[var(--surface)] rounded-[10px] shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">

 {/* Header */}
 <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
 <div>
 <h2 className="text-sm font-semibold text-[var(--text-bright)]">Import contacts</h2>
 <p className="text-xs text-[var(--text-muted)] mt-0.5">From a vCard (.vcf) or CSV file</p>
 </div>
 <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-subtle)] transition-colors">
 <X size={16} />
 </button>
 </div>

 <div className="flex-1 overflow-y-auto p-5 space-y-4">

 {/* Format toggle */}
 {rows.length === 0 && (
 <>
 <div className="flex bg-[var(--surface-2)] rounded-[4px] p-1 gap-1">
 {(['vcf', 'csv'] as FileType[]).map(t => (
 <button key={t} type="button" onClick={() => setFileType(t)}
 className={cn('flex-1 py-1.5 rounded-md text-xs font-medium transition-colors',
 fileType === t ? 'bg-[var(--surface)] text-[var(--text-bright)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-body)]'
 )}>
 {t === 'vcf' ? 'vCard (.vcf)' : 'CSV'}
 </button>
 ))}
 </div>

 <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-[10px] p-4 text-xs text-[var(--text-muted)] space-y-1.5">
 {fileType === 'vcf' ? (
 <>
 <p className="font-medium text-[var(--text-body)]">Export a vCard from:</p>
 <p>• <strong>Mac Contacts</strong> — select contacts → File → Export → Export vCard</p>
 <p>• <strong>Google Contacts</strong> — google.com/contacts → Export → vCard</p>
 <p>• <strong>iPhone</strong> — share a contact → select &quot;.vcf&quot;</p>
 <p>• <strong>Outlook</strong> — contact card → Save as → vCard</p>
 </>
 ) : (
 <>
 <p className="font-medium text-[var(--text-body)]">Export a CSV from:</p>
 <p>• <strong>Google Contacts</strong> — google.com/contacts → Export → Google CSV</p>
 <p>• <strong>Outlook</strong> — People → Manage → Export contacts → CSV</p>
 <p>• <strong>Any spreadsheet</strong> — columns: Name, Title, Email, Phone</p>
 </>
 )}
 </div>

 <div
 onClick={() => fileRef.current?.click()}
 className="border-2 border-dashed border-[var(--border)] rounded-[10px] p-8 text-center cursor-pointer hover:border-[var(--border)] hover:bg-[var(--surface-2)] transition-colors"
 >
 <Upload size={20} className="text-[var(--border)] mx-auto mb-2" />
 <p className="text-sm text-[var(--text-subtle)] font-medium">Click to select file</p>
 <p className="text-xs text-[var(--text-muted)] mt-1">{fileType === 'vcf' ? '.vcf' : '.csv, .txt'}</p>
 <input
 ref={fileRef}
 type="file"
 accept={fileType === 'vcf' ? '.vcf' : '.csv,.txt'}
 className="hidden"
 onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
 />
 </div>

 {error && <p className="text-xs text-[var(--red)]">{error}</p>}
 </>
 )}

 {/* Preview */}
 {rows.length > 0 && (
 <>
 <div className="flex items-center justify-between">
 <p className="text-xs text-[var(--text-muted)]">{rows.length} contacts found — {selectedCount} selected</p>
 <button type="button" onClick={() => setRows([])} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-subtle)]">
 Change file
 </button>
 </div>

 {/* Default area */}
 <div className="flex items-center gap-3 bg-[var(--surface-2)] rounded-[4px] px-3 py-2.5">
 <span className="text-xs text-[var(--text-muted)] shrink-0">Apply area to all:</span>
 <AreaSelect value={defaultArea} options={areas} onChange={applyDefaultArea} />
 </div>

 <div className="border border-[var(--border)] rounded-[10px] divide-y divide-[var(--border)] overflow-hidden">
 {rows.map((row, i) => (
 <div key={i} className={cn('flex items-start gap-3 px-4 py-3 transition-colors', !row.selected && 'opacity-40')}>
 <button type="button" onClick={() => toggle(i)}
 className={cn('mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
 row.selected ? 'bg-[var(--ink)] border-[var(--ink)]' : 'border-[var(--border-mid)]'
 )}>
 {row.selected && <Check size={10} className="text-white" />}
 </button>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <span className="text-sm font-medium text-[var(--text-bright)]">{row.name}</span>
 {row.title && <span className="text-xs text-[var(--text-muted)]">{row.title}</span>}
 </div>
 <div className="flex items-center gap-3 mt-0.5 flex-wrap">
 {row.email && <span className="text-xs text-[var(--text-muted)]">{row.email}</span>}
 {row.phone && <span className="text-xs text-[var(--text-muted)]">{row.phone}</span>}
 </div>
 </div>
 <div className="shrink-0 w-36">
 <AreaSelect value={row.area} options={areas} onChange={v => setArea(i, v)} />
 </div>
 </div>
 ))}
 </div>

 {error && <p className="text-xs text-[var(--red)]">{error}</p>}
 </>
 )}
 </div>

 {/* Footer */}
 {rows.length > 0 && (
 <div className="px-5 py-4 border-t border-[var(--border)] flex items-center justify-between gap-3">
 <button type="button" onClick={onClose} className="text-sm text-[var(--text-muted)] hover:text-[var(--text-body)]">
 Cancel
 </button>
 <button
 type="button"
 onClick={handleImport}
 disabled={selectedCount === 0 || importing || done}
 className="flex items-center gap-2 bg-[var(--ink)] text-[var(--ink-contrast)] text-xs font-medium h-7 px-3 rounded-[4px] hover:bg-[var(--ink)] disabled:opacity-50 transition-colors"
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
 className="w-full appearance-none bg-[var(--surface)] border border-[var(--border)] rounded-[4px] pl-2.5 pr-6 py-1.5 text-xs text-[var(--text-body)] focus:outline-none focus:ring-2"
 >
 {!value && <option value="">Select area…</option>}
 {options.map(o => <option key={o} value={o}>{o}</option>)}
 </select>
 <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
 </div>
 )
}
