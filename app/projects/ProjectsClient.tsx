'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, FolderOpen, Calendar, FileText, CheckCircle2, Clock, Pencil, Trash2, X, Loader2, ArrowRight, Search, Radio } from 'lucide-react'
import { AreaBadge } from '@/components/Badge'
import { formatRelativeDate } from '@/lib/utils'
import SelectField from '@/components/SelectField'

interface Project {
  id: string
  name: string
  area: string
  startDate: string | null
  status: string
  description: string
  createdAt: string
  reportCount: number
}

interface Props {
  projects: Project[]
  currentProjectId: string | null
  projectLabel: string
  projectLabelPlural: string
  defaultAreas: string[]
}

const EMPTY_FORM = { name: '', area: '', startDate: '', status: 'in_progress', description: '' }

type StatusFilter = 'all' | 'in_progress' | 'completed'

export default function ProjectsClient({ projects: initial, currentProjectId: initCurrent, projectLabel, projectLabelPlural, defaultAreas }: Props) {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>(initial)
  const [currentProjectId, setCurrentProjectId] = useState(initCurrent)
  const [showForm, setShowForm] = useState(initial.length === 0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const openCreate = () => { setEditingId(null); setForm(EMPTY_FORM); setShowForm(true) }
  const openEdit = (p: Project) => {
    setEditingId(p.id)
    setForm({ name: p.name, area: p.area, startDate: p.startDate?.slice(0, 10) ?? '', status: p.status, description: p.description })
    setShowForm(true)
  }
  const closeForm = () => { setShowForm(false); setEditingId(null) }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      if (editingId) {
        const res = await fetch(`/api/projects/${editingId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        const data = await res.json() as { project: Project }
        setProjects(ps => ps.map(p => p.id === editingId ? { ...p, ...data.project } : p))
      } else {
        const res = await fetch('/api/projects', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        const data = await res.json() as { project: Project }
        const newProject = { ...data.project, reportCount: 0 }
        setProjects(ps => [newProject, ...ps])
        setCurrentProjectId(data.project.id)
        window.dispatchEvent(new Event('project:changed'))
      }
      closeForm()
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await fetch(`/api/projects/${id}`, { method: 'DELETE' })
      setProjects(ps => ps.filter(p => p.id !== id))
      if (currentProjectId === id) setCurrentProjectId(null)
      router.refresh()
    } finally {
      setDeletingId(null)
    }
  }

  const switchTo = async (id: string) => {
    await fetch('/api/settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'current_project_id', value: id }),
    })
    setCurrentProjectId(id)
    window.dispatchEvent(new Event('project:changed'))
    router.refresh()
  }

  const goToProject = async (id: string) => {
    await switchTo(id)
    router.push('/')
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return projects.filter(p => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false
      if (q && !p.name.toLowerCase().includes(q) && !p.area.toLowerCase().includes(q) && !p.description.toLowerCase().includes(q)) return false
      return true
    })
  }, [projects, search, statusFilter])

  const inProgressCount = projects.filter(p => p.status === 'in_progress').length
  const completedCount = projects.filter(p => p.status === 'completed').length

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-zinc-50">{projectLabelPlural}</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
            Organise your work into {projectLabelPlural.toLowerCase()}. All documents, analysis and dispatch are scoped to the active {projectLabel.toLowerCase()}.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium rounded-lg hover:bg-gray-700 dark:hover:bg-zinc-200 transition-colors"
        >
          <Plus size={14} />
          New {projectLabel}
        </button>
      </div>

      {/* Create / Edit form */}
      {showForm && (
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-zinc-50">
              {editingId ? `Edit ${projectLabel}` : `New ${projectLabel}`}
            </h2>
            <button onClick={closeForm} className="text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors">
              <X size={14} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1.5">{projectLabel} name</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder={`e.g. ${projectLabel === 'Story' ? 'Operation Greenfield' : projectLabel === 'Matter' ? 'Smith v Jones' : 'Q2 Analysis'}`}
                autoFocus
                className="w-full border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1.5">Area</label>
              <SelectField
                value={form.area}
                onChange={v => setForm(f => ({ ...f, area: v }))}
                placeholder="No area"
                options={[{ value: '', label: 'No area' }, ...defaultAreas.map(a => ({ value: a, label: a }))]}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1.5">Start date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                className="w-full border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1.5">Status</label>
              <SelectField
                value={form.status}
                onChange={v => setForm(f => ({ ...f, status: v }))}
                options={[
                  { value: 'in_progress', label: 'In Progress' },
                  { value: 'completed', label: 'Completed' },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1.5">Description <span className="text-gray-400 dark:text-zinc-500 font-normal">(optional)</span></label>
              <input
                type="text"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Brief working hypothesis or description"
                className="w-full border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={closeForm} className="px-3 py-1.5 text-sm text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.name.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium rounded-lg hover:bg-gray-700 dark:hover:bg-zinc-200 disabled:opacity-40 transition-colors"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : null}
              {editingId ? 'Save changes' : `Create ${projectLabel}`}
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {projects.length === 0 && !showForm && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 bg-gray-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center mb-4">
            <FolderOpen size={24} className="text-gray-400 dark:text-zinc-500" />
          </div>
          <p className="text-base font-medium text-gray-600 dark:text-zinc-300">No {projectLabelPlural.toLowerCase()} yet</p>
          <p className="text-sm text-gray-400 dark:text-zinc-500 mt-1 max-w-xs">
            Create your first {projectLabel.toLowerCase()} to start organising your documents and analysis.
          </p>
          <button
            onClick={openCreate}
            className="mt-4 flex items-center gap-1.5 px-4 py-2 bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium rounded-lg hover:bg-gray-700 dark:hover:bg-zinc-200 transition-colors"
          >
            <Plus size={14} />
            Create {projectLabel}
          </button>
        </div>
      )}

      {/* Search + filter */}
      {projects.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={`Search ${projectLabelPlural.toLowerCase()}…`}
              className="w-full border border-gray-200 dark:border-zinc-700 rounded-lg pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500"
            />
          </div>
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-zinc-800 rounded-lg p-0.5">
            {([['all', 'All'], ['in_progress', 'Active'], ['completed', 'Completed']] as [StatusFilter, string][]).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setStatusFilter(val)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  statusFilter === val
                    ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-zinc-50 shadow-sm'
                    : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200'
                }`}
              >
                {label}
                {val === 'in_progress' && inProgressCount > 0 && <span className="ml-1 opacity-60">{inProgressCount}</span>}
                {val === 'completed' && completedCount > 0 && <span className="ml-1 opacity-60">{completedCount}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Project list */}
      {projects.length > 0 && (
        <div className="space-y-2">
          {filtered.length === 0 && (
            <p className="text-sm text-gray-400 dark:text-zinc-500 text-center py-8">No {projectLabelPlural.toLowerCase()} match your search.</p>
          )}

          {filtered.map(p => {
            const isActive = p.id === currentProjectId
            return (
              <div
                key={p.id}
                className={`group relative flex items-start gap-4 px-4 py-4 rounded-xl border transition-colors ${
                  isActive
                    ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/30'
                    : 'border-gray-200 dark:border-zinc-700 hover:border-gray-300 dark:hover:border-zinc-600 bg-white dark:bg-zinc-900'
                }`}
              >
                {/* Active indicator dot */}
                <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-indigo-500' : 'bg-gray-200 dark:bg-zinc-700'}`} />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900 dark:text-zinc-50">{p.name}</span>
                        {p.area && <AreaBadge area={p.area} />}
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded ${
                          p.status === 'completed'
                            ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                        }`}>
                          {p.status === 'completed' ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                          {p.status === 'completed' ? 'Completed' : 'In progress'}
                        </span>
                        {isActive && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                            <Radio size={9} />
                            Active
                          </span>
                        )}
                      </div>
                      {p.description && (
                        <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5 line-clamp-1">{p.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400 dark:text-zinc-500">
                        <span className="flex items-center gap-1"><FileText size={10} /> {p.reportCount} document{p.reportCount !== 1 ? 's' : ''}</span>
                        {p.startDate && <span className="flex items-center gap-1"><Calendar size={10} /> Started {new Date(p.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                        <span>Created {formatRelativeDate(new Date(p.createdAt))}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(p)}
                        className="p-1.5 text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded transition-colors"
                        title={`Edit ${projectLabel}`}
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        disabled={deletingId === p.id}
                        className="p-1.5 text-gray-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 rounded transition-colors"
                        title={`Delete ${projectLabel}`}
                      >
                        {deletingId === p.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Open / Set active */}
                {isActive ? (
                  <button
                    onClick={() => router.push('/')}
                    className="shrink-0 flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 transition-colors"
                  >
                    Go to overview <ArrowRight size={12} />
                  </button>
                ) : (
                  <button
                    onClick={() => goToProject(p.id)}
                    className="shrink-0 flex items-center gap-1 text-xs font-medium text-gray-400 dark:text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    title="Set as active and go to overview"
                  >
                    Open <ArrowRight size={12} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
