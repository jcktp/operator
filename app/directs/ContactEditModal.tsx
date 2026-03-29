'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMode } from '@/components/ModeContext'
import { type DirectReport } from '@/app/types'
import AreaDropdown from './AreaDropdown'

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await onSave({ ...contact, ...form })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-zinc-50">Edit {modeConfig.personLabel.toLowerCase()}</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">Name *</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required className="w-full border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-100" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">Title *</label>
              <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                required className="w-full border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-100" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Area *</label>
            <AreaDropdown value={form.area} options={areas} onChange={v => setForm(f => ({ ...f, area: v }))} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="jane@company.com"
                className="w-full border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">Phone</label>
              <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+1 555 123 4567"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Quick context — relationship, how you met, last discussed…"
              rows={3}
              className="w-full border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 resize-none"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => onDelete(contact.id)}
              className={cn(
                'text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors',
                deletingId === contact.id
                  ? 'border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950'
                  : 'border-gray-200 dark:border-zinc-700 text-gray-400 dark:text-zinc-500 hover:text-red-500 hover:border-red-200 dark:hover:border-red-800'
              )}
            >
              {deletingId === contact.id ? 'Confirm delete' : 'Delete'}
            </button>

            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-gray-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50">
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
