'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, FolderOpen, X, Loader2, Search, Share2 } from 'lucide-react'
import SelectField from '@/components/SelectField'
import dynamic from 'next/dynamic'
import ProjectListItem from './ProjectListItem'

const CollabPanel = dynamic(() => import('@/components/collab/CollabPanel'), { ssr: false })

interface Project {
 id: string
 name: string
 area: string
 startDate: string | null
 status: string
 description: string
 createdAt: string
 reportCount: number
 shareCount: number
}

interface Props {
 projects: Project[]
 currentProjectId: string | null
 projectLabel: string
 projectLabelPlural: string
 defaultAreas: string[]
 collabEnabled?: boolean
}

const EMPTY_FORM = { name: '', area: '', startDate: '', status: 'in_progress', description: '' }

type StatusFilter = 'all' | 'in_progress' | 'completed'
type CollabTab = 'peers' | 'sync' | 'conflicts' | 'share' | 'chat'

export default function ProjectsClient({ projects: initial, currentProjectId: initCurrent, projectLabel, projectLabelPlural, defaultAreas, collabEnabled }: Props) {
 const router = useRouter()
 const [projects, setProjects] = useState<Project[]>(initial)
 const [currentProjectId, setCurrentProjectId] = useState(initCurrent)
 const [showForm, setShowForm] = useState(initial.length === 0)
 const [editingId, setEditingId] = useState<string | null>(null)
 const [form, setForm] = useState(EMPTY_FORM)
 const [shareOnCreate, setShareOnCreate] = useState(false)
 const [saving, setSaving] = useState(false)
 const [deletingId, setDeletingId] = useState<string | null>(null)
 const [search, setSearch] = useState('')
 const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
 const [collabProjectId, setCollabProjectId] = useState<string | null>(null)
 const [collabInitialTab, setCollabInitialTab] = useState<CollabTab>('peers')
 const [unreadPerProject, setUnreadPerProject] = useState<Record<string, number>>({})
 const [totalUnread, setTotalUnread] = useState(0)
 const [collabActive, setCollabActive] = useState(collabEnabled ?? false)

 const handleShareOnCreateToggle = async () => {
 const next = !shareOnCreate
 setShareOnCreate(next)
 if (next && !collabActive) {
 await fetch('/api/settings', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ key: 'collab_enabled', value: 'true' }),
 }).catch(() => {})
 setCollabActive(true)
 window.dispatchEvent(new Event('collab:enabled'))
 }
 }

 // Fetch unread counts when collab is enabled
 useEffect(() => {
 if (!collabActive) return
 const fetchUnread = () => {
 fetch('/api/collab/notifications/unread')
 .then(r => r.ok ? r.json() : null)
 .then((d: { total: number; perProject: Record<string, number> } | null) => {
 if (!d) return
 setUnreadPerProject(d.perProject ?? {})
 setTotalUnread(d.total ?? 0)
 })
 .catch(() => {})
 }
 fetchUnread()
 const timer = setInterval(fetchUnread, 60_000)
 return () => clearInterval(timer)
 }, [collabActive])

 const openCreate = () => { setEditingId(null); setForm(EMPTY_FORM); setShareOnCreate(false); setShowForm(true) }
 const openEdit = (p: Project) => {
 setEditingId(p.id)
 setForm({ name: p.name, area: p.area, startDate: p.startDate?.slice(0, 10) ?? '', status: p.status, description: p.description })
 setShowForm(true)
 }
 const closeForm = () => { setShowForm(false); setEditingId(null); setShareOnCreate(false) }

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
 if (collabActive && shareOnCreate) {
 setCollabProjectId(data.project.id)
 setCollabInitialTab('share')
 }
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
 <h1 className="text-2xl font-semibold text-[var(--text-bright)]">{projectLabelPlural}</h1>
 <p className="text-sm text-[var(--text-muted)] mt-1">
 Organise your work into {projectLabelPlural.toLowerCase()}. All documents, analysis and dispatch are scoped to the active {projectLabel.toLowerCase()}.
 </p>
 </div>
 <button
 onClick={openCreate}
 className="flex items-center gap-1.5 h-7 px-2.5 bg-[var(--ink)] text-[var(--ink-contrast)] text-xs font-medium rounded-[4px] hover:opacity-90 transition-colors"
 >
 <Plus size={14} />
 New {projectLabel}
 </button>
 </div>

 {/* Create / Edit form */}
 {showForm && (
 <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-5 space-y-4">
 <div className="flex items-center justify-between">
 <h2 className="text-sm font-semibold text-[var(--text-bright)]">
 {editingId ? `Edit ${projectLabel}` : `New ${projectLabel}`}
 </h2>
 <button onClick={closeForm} className="text-[var(--text-muted)] hover:text-[var(--text-subtle)] transition-colors">
 <X size={14} />
 </button>
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div className="col-span-2">
 <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1.5">{projectLabel} name</label>
 <input
 type="text"
 value={form.name}
 onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
 placeholder={`e.g. ${projectLabel === 'Story' ? 'Operation Greenfield' : projectLabel === 'Matter' ? 'Smith v Jones' : 'Q2 Analysis'}`}
 autoFocus
 className="w-full h-8 border border-[var(--border)] rounded-[4px] px-2.5 text-xs focus:outline-none focus:ring-2"
 />
 </div>

 <div>
 <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1.5">Area</label>
 <SelectField
 value={form.area}
 onChange={v => setForm(f => ({ ...f, area: v }))}
 placeholder="No area"
 options={[{ value: '', label: 'No area' }, ...defaultAreas.map(a => ({ value: a, label: a }))]}
 />
 </div>

 <div>
 <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1.5">Start date</label>
 <input
 type="date"
 value={form.startDate}
 onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
 className="w-full h-8 border border-[var(--border)] rounded-[4px] px-2.5 text-xs focus:outline-none focus:ring-2"
 />
 </div>

 <div>
 <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1.5">Status</label>
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
 <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1.5">Description <span className="text-[var(--text-muted)] font-normal">(optional)</span></label>
 <input
 type="text"
 value={form.description}
 onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
 placeholder="Brief working hypothesis or description"
 className="w-full h-8 border border-[var(--border)] rounded-[4px] px-2.5 text-xs focus:outline-none focus:ring-2"
 />
 </div>
 </div>

 {/* Share on create — new projects only */}
 {!editingId && (
 <div className="flex items-center gap-2 pt-1">
 <button
 type="button"
 role="switch"
 aria-checked={shareOnCreate}
 onClick={handleShareOnCreateToggle}
 className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${shareOnCreate ? 'bg-[var(--blue)]' : 'bg-[var(--surface-3)]'}`}
 >
 <span className={`inline-block h-2.5 w-2.5 transform rounded-full bg-[var(--surface)] transition-transform ${shareOnCreate ? 'translate-x-3' : 'translate-x-0.5'}`} />
 </button>
 <span className="text-xs text-[var(--text-subtle)]">
 {shareOnCreate && !collabEnabled ? 'Enable collaboration & open sharing' : 'Open sharing settings after creation'}
 </span>
 </div>
 )}

 {/* Manage sharing — edit form only */}
 {editingId && collabActive && (
 <div className="flex items-center gap-3 pt-1">
 <button
 type="button"
 onClick={() => { setCollabProjectId(editingId); setCollabInitialTab('peers') }}
 className="flex items-center gap-1.5 h-7 px-2.5 rounded-[4px] text-xs font-medium border border-[var(--border)] text-[var(--text-subtle)] hover:bg-[var(--surface-2)] transition-colors"
 >
 <Share2 size={11} />
 Manage sharing
 </button>
 {(projects.find(p => p.id === editingId)?.shareCount ?? 0) > 0 && (
 <span className="text-xs text-[var(--blue)]">
 {projects.find(p => p.id === editingId)?.shareCount} peer{(projects.find(p => p.id === editingId)?.shareCount ?? 0) !== 1 ? 's' : ''} connected
 </span>
 )}
 </div>
 )}

 <div className="flex justify-end gap-2">
 <button onClick={closeForm} className="px-3 py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-body)] transition-colors">
 Cancel
 </button>
 <button
 onClick={handleSave}
 disabled={saving || !form.name.trim()}
 className="flex items-center gap-1.5 px-4 py-1.5 bg-[var(--ink)] text-[var(--ink-contrast)] text-sm font-medium rounded-[4px] hover:opacity-90 disabled:opacity-40 transition-colors"
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
 <div className="w-14 h-14 bg-[var(--surface-2)] rounded-[10px] flex items-center justify-center mb-4">
 <FolderOpen size={24} className="text-[var(--text-muted)]" />
 </div>
 <p className="text-base font-medium text-[var(--text-subtle)]">No {projectLabelPlural.toLowerCase()} yet</p>
 <p className="text-sm text-[var(--text-muted)] mt-1 max-w-xs">
 Create your first {projectLabel.toLowerCase()} to start organising your documents and analysis.
 </p>
 <button
 onClick={openCreate}
 className="mt-4 flex items-center gap-1.5 h-7 px-2.5 bg-[var(--ink)] text-[var(--ink-contrast)] text-xs font-medium rounded-[4px] hover:opacity-90 transition-colors"
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
 <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
 <input
 type="text"
 value={search}
 onChange={e => setSearch(e.target.value)}
 placeholder={`Search ${projectLabelPlural.toLowerCase()}…`}
 className="w-full border border-[var(--border)] rounded-[4px] pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 placeholder-gray-400"
 />
 </div>
 <div className="flex items-center gap-1 bg-[var(--surface-2)] rounded-[4px] p-0.5">
 {([['all', 'All'], ['in_progress', 'Active'], ['completed', 'Completed']] as [StatusFilter, string][]).map(([val, label]) => (
 <button
 key={val}
 onClick={() => setStatusFilter(val)}
 className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
 statusFilter === val
 ? 'bg-[var(--surface)] text-[var(--text-bright)] shadow-sm'
 : 'text-[var(--text-muted)] hover:text-[var(--text-body)]'
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

 {/* Collaboration panel */}
 {collabActive && collabProjectId && (
 <CollabPanel
 projectId={collabProjectId}
 projectName={projects.find(p => p.id === collabProjectId)?.name ?? ''}
 onClose={() => { setCollabProjectId(null); setCollabInitialTab('peers') }}
 initialTab={collabInitialTab}
 unreadCount={unreadPerProject[collabProjectId] ?? 0}
 />
 )}

 {/* Project list */}
 {projects.length > 0 && (
 <div className="space-y-2">
 {filtered.length === 0 && (
 <p className="text-sm text-[var(--text-muted)] text-center py-8">No {projectLabelPlural.toLowerCase()} match your search.</p>
 )}

 {filtered.map(p => (
 <ProjectListItem
 key={p.id}
 project={p}
 isActive={p.id === currentProjectId}
 projectLabel={projectLabel}
 collabActive={collabActive}
 deletingId={deletingId}
 unreadCount={unreadPerProject[p.id] ?? 0}
 onEdit={openEdit}
 onDelete={handleDelete}
 onOpenCollab={(id, tab) => { setCollabProjectId(id); setCollabInitialTab(tab) }}
 onGoToProject={goToProject}
 />
 ))}
 </div>
 )}
 </div>
 )
}
