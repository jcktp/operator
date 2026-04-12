'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMode } from '@/components/ModeContext'
import { type DirectReport } from '@/app/types'
import AreaDropdown from './AreaDropdown'
import Input from '@/components/ui/Input'

export default function ContactEditModal({
 contact,
 areas,
 onClose,
 onSave,
 onDelete,
 deletingId,
 modeConfig,
}: {
 contact: DirectReport
 areas: string[]
 onClose: () => void
 onSave: (updated: DirectReport) => Promise<void>
 onDelete: (id: string) => void
 deletingId: string | null
 modeConfig: ReturnType<typeof useMode>
}) {
 const [form, setForm] = useState({
 name: contact.name,
 title: contact.title,
 email: contact.email ?? '',
 phone: contact.phone ?? '',
 area: contact.area,
 notes: contact.notes ?? '',
 })
 const [saving, setSaving] = useState(false)

 const [saveError, setSaveError] = useState<string | null>(null)

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault()
 setSaving(true)
 setSaveError(null)
 try {
 await onSave({ ...contact, ...form })
 } catch (err) {
 console.error('Failed to save contact:', err)
 setSaveError('Failed to save — please try again.')
 }
 setSaving(false)
 }

 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
 <div
 className="bg-[var(--surface)] rounded-[10px] shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
 onClick={e => e.stopPropagation()}
 >
 <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
 <h2 className="text-sm font-semibold text-[var(--text-bright)]">Edit {modeConfig.personLabel.toLowerCase()}</h2>
 <button onClick={onClose} className="p-1 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--text-subtle)] hover:bg-[var(--surface-2)] transition-colors">
 <X size={15} />
 </button>
 </div>

 <form onSubmit={handleSubmit} className="p-5 space-y-4">
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Name *</label>
 <Input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
 </div>
 <div>
 <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Title *</label>
 <Input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
 </div>
 </div>

 <div>
 <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Area *</label>
 <AreaDropdown value={form.area} options={areas} onChange={v => setForm(f => ({ ...f, area: v }))} />
 </div>

 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Email</label>
 <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@company.com" />
 </div>
 <div>
 <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Phone</label>
 <Input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1 555 123 4567" />
 </div>
 </div>

 <div>
 <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Notes</label>
 <textarea
 value={form.notes}
 onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
 placeholder="Quick context — relationship, how you met, last discussed…"
 rows={3}
 className="w-full h-8 border border-[var(--border)] rounded-[4px] px-2.5 text-xs focus:outline-none focus:ring-2 resize-none"
 />
 </div>

 {saveError && <p className="text-xs text-[var(--red)]">{saveError}</p>}
 <div className="flex items-center justify-between pt-1">
 <button
 type="button"
 onClick={() => onDelete(contact.id)}
 className={cn(
 'text-xs font-medium px-3 py-1.5 rounded-[4px] border transition-colors',
 deletingId === contact.id
 ? 'border-red-300 text-[var(--red)] bg-[var(--red-dim)]'
 : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--red)] hover:border-[var(--red)]'
 )}
 >
 {deletingId === contact.id ? 'Confirm delete' : 'Delete'}
 </button>

 <div className="flex items-center gap-2">
 <button type="button" onClick={onClose}
 className="text-xs font-medium px-3 py-1.5 rounded-[4px] border border-[var(--border)] text-[var(--text-subtle)] hover:bg-[var(--surface-2)] transition-colors">
 Cancel
 </button>
 <button type="submit" disabled={saving}
 className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-[4px] bg-[var(--ink)] text-[var(--ink-contrast)] hover:bg-[var(--ink)] transition-colors disabled:opacity-50">
 {saving && <Loader2 size={11} className="animate-spin" />}
 Save
 </button>
 </div>
 </div>
 </form>
 </div>
 </div>
 )
}
