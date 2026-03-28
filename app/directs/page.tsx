'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { formatRelativeDate } from '@/lib/utils'
import { AreaBadge } from '@/components/Badge'
import { Users, Plus, Trash2, Loader2, X, ChevronDown, Search, Upload } from 'lucide-react'
import { useMode } from '@/components/ModeContext'
import { cn } from '@/lib/utils'
import ContactImporter from './ContactImporter'

interface DirectReport {
  id: string
  name: string
  title: string
  email?: string
  phone?: string
  area: string
  createdAt: string
  reports: { createdAt: string; area: string }[]
}

export default function DirectsPage() {
  const modeConfig = useMode()
  const [directs, setDirects] = useState<DirectReport[]>([])
  const [areas, setAreas] = useState<string[]>(modeConfig.defaultAreas)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showImporter, setShowImporter] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', title: '', email: '', phone: '', area: '' })
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const load = async () => {
    const res = await fetch('/api/directs')
    const data = await res.json()
    setDirects(data.directs ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // Load custom areas from settings
    fetch('/api/settings')
      .then(r => r.json())
      .then((data: { settings?: Record<string, string> }) => {
        const s = data.settings ?? {}
        if (s.custom_areas) {
          try {
            const parsed = JSON.parse(s.custom_areas) as string[]
            if (Array.isArray(parsed) && parsed.length > 0) { setAreas(parsed); return }
          } catch {}
        }
        setAreas(modeConfig.defaultAreas)
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.area) return
    setSaving(true)
    await fetch('/api/directs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setForm({ name: '', title: '', email: '', phone: '', area: '' })
    setShowForm(false)
    setSaving(false)
    load()
  }

  const handleDelete = async (id: string) => {
    if (deletingId !== id) {
      setDeletingId(id)
      setTimeout(() => setDeletingId(null), 3000)
      return
    }
    await fetch(`/api/directs/${id}`, { method: 'DELETE' })
    load()
    setDeletingId(null)
  }

  const q = search.toLowerCase().trim()
  const filtered = q
    ? directs.filter(d =>
        d.name.toLowerCase().includes(q) ||
        d.title.toLowerCase().includes(q) ||
        d.area.toLowerCase().includes(q) ||
        d.email?.toLowerCase().includes(q) ||
        d.phone?.includes(q)
      )
    : directs

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      {showImporter && (
        <ContactImporter
          areas={areas}
          onClose={() => setShowImporter(false)}
          onImported={() => { load() }}
        />
      )}

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{modeConfig.navPeople}</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {modeConfig.personLabelPlural} you work with, by {modeConfig.collectionLabel.toLowerCase()}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImporter(true)}
            className="inline-flex items-center gap-1.5 border border-gray-200 text-gray-700 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Upload size={14} />
            Import
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-1.5 bg-gray-900 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
          >
            {showForm ? <X size={14} /> : <Plus size={14} />}
            {showForm ? 'Cancel' : `Add ${modeConfig.personLabel.toLowerCase()}`}
          </button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleAdd} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Add {modeConfig.personLabel.toLowerCase()}</h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required placeholder="Jane Smith"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
              <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                required placeholder="CFO"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Area *</label>
              <AreaDropdown value={form.area} options={areas} onChange={v => setForm(f => ({ ...f, area: v }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="jane@company.com"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
              <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+1 555 123 4567"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
          </div>

          <button type="submit" disabled={saving}
            className="bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 size={13} className="animate-spin" />}
            Save
          </button>
        </form>
      )}

      {/* Search */}
      {directs.length > 0 && (
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${modeConfig.personLabelPlural.toLowerCase()} by name, title, area…`}
            className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={13} />
            </button>
          )}
        </div>
      )}

      {/* List */}
      {directs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center mb-3">
            <Users size={18} className="text-gray-400" />
          </div>
          <p className="text-sm text-gray-500">No {modeConfig.personLabelPlural.toLowerCase()} yet.</p>
          <p className="text-xs text-gray-400 mt-1">Add them manually or import from a contacts file.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-gray-400">No results for &quot;{search}&quot;</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          {filtered.map(d => (
            <div key={d.id} className="flex items-center justify-between px-4 py-4 gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="text-sm font-medium text-gray-900">{d.name}</span>
                  <span className="text-xs text-gray-500">{d.title}</span>
                  <AreaBadge area={d.area} />
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                  {d.email && (
                    <a href={`mailto:${d.email}`} className="hover:text-gray-600 transition-colors">{d.email}</a>
                  )}
                  {d.phone && (
                    <a href={`tel:${d.phone}`} className="hover:text-gray-600 transition-colors">{d.phone}</a>
                  )}
                  {d.reports.length > 0 ? (
                    <span>Last {modeConfig.documentLabel.toLowerCase()} {formatRelativeDate(d.reports[0].createdAt)}</span>
                  ) : (
                    <span>No {modeConfig.documentLabelPlural.toLowerCase()} yet</span>
                  )}
                </div>
              </div>

              <button
                onClick={() => handleDelete(d.id)}
                className={cn('shrink-0 text-xs font-medium px-2 py-1 rounded border transition-colors',
                  deletingId === d.id
                    ? 'border-red-300 text-red-600 bg-red-50'
                    : 'border-gray-200 text-gray-400 hover:text-gray-600'
                )}
              >
                {deletingId === d.id ? 'Confirm' : <Trash2 size={13} />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AreaDropdown({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white h-[38px]">
        <span className={value ? 'text-gray-900' : 'text-gray-400'}>{value || 'Select…'}</span>
        <ChevronDown size={14} className="text-gray-400 shrink-0" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-md py-1 max-h-48 overflow-y-auto">
          {options.map(o => (
            <button key={o} type="button" onClick={() => { onChange(o); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-gray-900">
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
