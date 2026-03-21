'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { formatRelativeDate, AREAS } from '@/lib/utils'
import { AreaBadge } from '@/components/Badge'
import { Users, Plus, Trash2, Loader2, X } from 'lucide-react'

interface DirectReport {
  id: string
  name: string
  title: string
  email?: string
  area: string
  createdAt: string
  reports: { createdAt: string; area: string }[]
}

export default function DirectsPage() {
  const [directs, setDirects] = useState<DirectReport[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', title: '', email: '', area: '' })
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = async () => {
    const res = await fetch('/api/directs')
    const data = await res.json()
    setDirects(data.directs ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/directs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setForm({ name: '', title: '', email: '', area: '' })
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Direct Reports</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            The people who report to you, by area.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1.5 bg-gray-900 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
        >
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? 'Cancel' : 'Add direct'}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleAdd} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Add direct report</h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
                placeholder="Jane Smith"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                required
                placeholder="CFO"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Area *</label>
              <select
                value={form.area}
                onChange={e => setForm(f => ({ ...f, area: e.target.value }))}
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
              >
                <option value="">Select…</option>
                {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="jane@company.com"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            Save
          </button>
        </form>
      )}

      {/* Directs list */}
      {directs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center mb-3">
            <Users size={18} className="text-gray-400" />
          </div>
          <p className="text-sm text-gray-500">No direct reports yet.</p>
          <p className="text-xs text-gray-400 mt-1">Add them to track who sends which reports.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          {directs.map(d => (
            <div key={d.id} className="flex items-center justify-between px-4 py-4 gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium text-gray-900">{d.name}</span>
                  <span className="text-xs text-gray-500">{d.title}</span>
                  <AreaBadge area={d.area} />
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  {d.email && <span>{d.email}</span>}
                  {d.reports.length > 0 ? (
                    <span>Last report {formatRelativeDate(d.reports[0].createdAt)}</span>
                  ) : (
                    <span>No reports yet</span>
                  )}
                </div>
              </div>

              <button
                onClick={() => handleDelete(d.id)}
                className={`shrink-0 text-xs font-medium px-2 py-1 rounded border transition-colors ${
                  deletingId === d.id
                    ? 'border-red-300 text-red-600 bg-red-50'
                    : 'border-gray-200 text-gray-400 hover:text-gray-600'
                }`}
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
