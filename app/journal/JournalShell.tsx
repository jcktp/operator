'use client'

import { useState, useMemo } from 'react'
import { Plus, FolderOpen, FileText, Trash2, ChevronRight, ChevronDown, Edit2, PenLine, Eye, X, BookMarked, Search } from 'lucide-react'
import JournalEditor from './JournalEditor'
import { useMode } from '@/components/ModeContext'

interface JournalEntry {
  id: string
  title: string
  folder: string
  content: string
  updatedAt: string
}

interface Props {
  entries: JournalEntry[]
}

const DEFAULT_FOLDER = 'General'
const INVESTIGATION_SUBFOLDERS = ['Sources', 'Timeline', 'Claims', 'Documents', 'Notes']

export default function JournalShell({ entries: initial }: Props) {
  const modeConfig = useMode()
  const { investigationTemplate: isInvestigationMode } = modeConfig.features
  const [entries, setEntries] = useState(initial)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'view' | 'edit'>('view')
  const [investigationPrompt, setInvestigationPrompt] = useState<string | null>(null)
  const [creatingTemplate, setCreatingTemplate] = useState(false)

  // Always expand all known folders + General on load
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    const folds = initial.map(e => e.folder)
    return new Set([...folds, DEFAULT_FOLDER])
  })

  // newNoteFolder = which folder the inline create form is open in
  const [newNoteFolder, setNewNoteFolder] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newFolderName, setNewFolderName] = useState('')
  const [editingTitle, setEditingTitle] = useState<string | null>(null)
  const [editTitleValue, setEditTitleValue] = useState('')

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return entries
    return entries.filter(e =>
      e.title.toLowerCase().includes(q) ||
      e.content.toLowerCase().includes(q)
    )
  }, [entries, search])

  const folders = [...new Set([DEFAULT_FOLDER, ...entries.map(e => e.folder)])].sort()
  const visibleFolders = search.trim()
    ? [...new Set(filteredEntries.map(e => e.folder))].sort()
    : folders
  const selected = entries.find(e => e.id === selectedId)

  const toggleFolder = (f: string) =>
    setExpandedFolders(prev => { const s = new Set(prev); s.has(f) ? s.delete(f) : s.add(f); return s })

  const openNewNoteForm = (folder: string) => {
    setNewNoteFolder(folder)
    setNewTitle('')
    setExpandedFolders(prev => new Set([...prev, folder]))
  }

  const createNote = async (folder?: string) => {
    const title = newTitle.trim() || 'Untitled'
    const targetFolder = folder ?? newNoteFolder ?? DEFAULT_FOLDER
    const res = await fetch('/api/journal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, folder: targetFolder, content: '' }),
    })
    if (!res.ok) return
    const data = await res.json()
    const entry: JournalEntry = {
      id: data.entry.id,
      title: data.entry.title,
      folder: data.entry.folder,
      content: '',
      updatedAt: data.entry.updatedAt,
    }
    setEntries(prev => [entry, ...prev])
    setSelectedId(entry.id)
    setViewMode('edit') // new notes open directly in edit mode
    setExpandedFolders(prev => new Set([...prev, entry.folder]))
    setNewNoteFolder(null)
    setNewTitle('')
  }

  const createFolder = async () => {
    const folder = newFolderName.trim()
    if (!folder) return
    setNewFolderName('')
    // Create folder by making a first note in it
    const res = await fetch('/api/journal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Untitled', folder, content: '' }),
    })
    if (!res.ok) return
    const data = await res.json()
    const entry: JournalEntry = {
      id: data.entry.id,
      title: data.entry.title,
      folder: data.entry.folder,
      content: '',
      updatedAt: data.entry.updatedAt,
    }
    setEntries(prev => [entry, ...prev])
    setSelectedId(entry.id)
    setViewMode('edit')
    setExpandedFolders(prev => new Set([...prev, folder]))
    if (isInvestigationMode) setInvestigationPrompt(folder)
  }

  const createInvestigationTemplate = async (baseName: string) => {
    setCreatingTemplate(true)
    setInvestigationPrompt(null)
    const newEntries: JournalEntry[] = []
    for (const sub of INVESTIGATION_SUBFOLDERS) {
      const folderName = `${baseName} · ${sub}`
      const res = await fetch('/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Notes', folder: folderName, content: '' }),
      })
      if (!res.ok) continue
      const data = await res.json()
      newEntries.push({
        id: data.entry.id,
        title: data.entry.title,
        folder: data.entry.folder,
        content: '',
        updatedAt: data.entry.updatedAt,
      })
    }
    setEntries(prev => [...newEntries, ...prev])
    setExpandedFolders(prev => new Set([...prev, ...newEntries.map(e => e.folder)]))
    setCreatingTemplate(false)
  }

  const deleteNote = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await fetch('/api/journal', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const remaining = entries.filter(e => e.id !== id)
    setEntries(remaining)
    if (selectedId === id) setSelectedId(remaining[0]?.id ?? null)
  }

  const renameNote = async (id: string) => {
    const title = editTitleValue.trim()
    if (!title) { setEditingTitle(null); return }
    await fetch('/api/journal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, title }),
    })
    setEntries(prev => prev.map(e => e.id === id ? { ...e, title } : e))
    setEditingTitle(null)
  }

  return (
    <div className="flex gap-0 items-start h-[calc(100vh-140px)] min-h-[500px]">
      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <div className="w-60 shrink-0 border-r border-gray-200 dark:border-zinc-700 h-full overflow-y-auto pb-4 pr-1">

        {/* Search */}
        <div className="relative mb-3">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search notes…"
            className="w-full text-xs pl-7 pr-2 py-2 border border-gray-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-inset focus:ring-gray-900 dark:focus:ring-zinc-400 placeholder-gray-400 dark:placeholder-zinc-500 bg-white dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>

        {/* New note button — always visible */}
        <button
          onClick={() => openNewNoteForm(
            // Open form in currently selected note's folder, or General
            selected?.folder ?? DEFAULT_FOLDER
          )}
          className="w-full flex items-center gap-2 px-3 py-2 mb-3 bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium rounded-xl hover:bg-gray-800 dark:hover:bg-zinc-200 transition-colors"
        >
          <PenLine size={12} />
          New note
        </button>

        {/* New folder input */}
        <div className="flex gap-1 mb-4">
          <input
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createFolder() }}
            placeholder="+ New folder…"
            className="flex-1 text-xs border border-dashed border-gray-300 dark:border-zinc-600 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-900 dark:focus:ring-zinc-400 placeholder-gray-400 dark:placeholder-zinc-500 dark:bg-zinc-800 dark:text-zinc-100 min-w-0"
          />
          {newFolderName.trim() && (
            <button onClick={createFolder}
              className="shrink-0 px-2 py-1.5 bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs rounded-lg hover:bg-gray-800 dark:hover:bg-zinc-200 transition-colors">
              <Plus size={11} />
            </button>
          )}
        </div>

        {/* Journalism: investigation template prompt */}
        {investigationPrompt && (
          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2.5 mb-3 space-y-2">
            <div className="flex items-center gap-1.5">
              <BookMarked size={12} className="text-amber-600 dark:text-amber-400 shrink-0" />
              <p className="text-xs font-medium text-amber-800 dark:text-amber-300">Set up investigation folders?</p>
            </div>
            <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-snug">
              Create sub-folders for <strong>{investigationPrompt}</strong>: Sources, Timeline, Claims, Documents, Notes
            </p>
            <div className="flex gap-1.5">
              <button
                onClick={() => createInvestigationTemplate(investigationPrompt)}
                disabled={creatingTemplate}
                className="flex-1 text-[11px] font-medium px-2 py-1 bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors disabled:opacity-50"
              >
                {creatingTemplate ? 'Creating…' : 'Yes, create'}
              </button>
              <button
                onClick={() => setInvestigationPrompt(null)}
                className="flex-1 text-[11px] text-amber-700 dark:text-amber-300 py-1 rounded border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors"
              >
                Skip
              </button>
            </div>
          </div>
        )}

        {/* Folder tree */}
        {visibleFolders.map(folder => {
          const folderEntries = (search.trim() ? filteredEntries : entries).filter(e => e.folder === folder)
          const isExpanded = search.trim() ? true : expandedFolders.has(folder)
          return (
            <div key={folder} className="mb-1">
              {/* Folder row */}
              <div className="flex items-center group">
                <button
                  onClick={() => toggleFolder(folder)}
                  className="flex items-center gap-1.5 flex-1 px-2 py-1.5 rounded-lg text-left hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors min-w-0"
                >
                  {isExpanded
                    ? <ChevronDown size={11} className="text-gray-400 dark:text-zinc-500 shrink-0" />
                    : <ChevronRight size={11} className="text-gray-400 dark:text-zinc-500 shrink-0" />}
                  <FolderOpen size={12} className="text-amber-400 shrink-0" />
                  <span className="text-xs font-medium text-gray-700 dark:text-zinc-200 truncate flex-1">{folder}</span>
                  <span className="text-[10px] text-gray-400 dark:text-zinc-500 shrink-0 ml-1">{folderEntries.length}</span>
                </button>
                {/* Always-visible + button on folder */}
                <button
                  onClick={() => openNewNoteForm(folder)}
                  className="shrink-0 p-1 text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded transition-colors"
                  title={`New note in ${folder}`}
                >
                  <Plus size={11} />
                </button>
              </div>

              {isExpanded && (
                <div className="ml-4 mt-0.5 space-y-0.5">
                  {/* Inline new note form */}
                  {newNoteFolder === folder && (
                    <div className="flex gap-1 py-1 pr-1">
                      <input
                        autoFocus
                        value={newTitle}
                        onChange={e => setNewTitle(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') createNote()
                          if (e.key === 'Escape') setNewNoteFolder(null)
                        }}
                        placeholder="Note title…"
                        className="flex-1 text-xs border border-gray-300 dark:border-zinc-600 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-900 dark:focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-100 min-w-0"
                      />
                      <button
                        onClick={() => createNote()}
                        className="shrink-0 text-[10px] font-medium px-2 py-1.5 bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-gray-800 dark:hover:bg-zinc-200 whitespace-nowrap"
                      >
                        Save
                      </button>
                    </div>
                  )}

                  {/* Note entries */}
                  {folderEntries.map(entry => (
                    <div
                      key={entry.id}
                      onClick={() => { setSelectedId(entry.id); setViewMode('view') }}
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer group/note transition-colors ${
                        selectedId === entry.id ? 'bg-gray-100 dark:bg-zinc-800' : 'hover:bg-gray-50 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <FileText size={11} className="shrink-0 text-gray-400 dark:text-zinc-500" />
                      {editingTitle === entry.id ? (
                        <input
                          autoFocus
                          value={editTitleValue}
                          onChange={e => setEditTitleValue(e.target.value)}
                          onBlur={() => renameNote(entry.id)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') renameNote(entry.id)
                            if (e.key === 'Escape') setEditingTitle(null)
                          }}
                          onClick={e => e.stopPropagation()}
                          className="flex-1 text-xs bg-transparent border-b border-gray-400 dark:border-zinc-500 dark:text-zinc-100 outline-none min-w-0"
                        />
                      ) : (
                        <span className={`text-xs truncate flex-1 min-w-0 ${selectedId === entry.id ? 'text-gray-900 dark:text-zinc-50 font-medium' : 'text-gray-600 dark:text-zinc-300'}`}>
                          {entry.title}
                        </span>
                      )}
                      <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover/note:opacity-100 transition-opacity">
                        <button
                          onClick={e => { e.stopPropagation(); setEditingTitle(entry.id); setEditTitleValue(entry.title) }}
                          className="p-0.5 rounded text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-200"
                        >
                          <Edit2 size={9} />
                        </button>
                        <button
                          onClick={e => deleteNote(entry.id, e)}
                          className="p-0.5 rounded text-gray-400 hover:text-red-500"
                        >
                          <Trash2 size={9} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {folderEntries.length === 0 && newNoteFolder !== folder && (
                    <p className="text-[10px] text-gray-400 dark:text-zinc-500 px-2 py-1">Empty — click + to add a note</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Editor ───────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 h-full overflow-y-auto pl-6">
        {selected ? (
          <div className="space-y-3">
            {/* Note header */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs text-gray-400 dark:text-zinc-500 shrink-0">{selected.folder}</span>
                <span className="text-xs text-gray-300 dark:text-zinc-600 shrink-0">/</span>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-zinc-50 truncate">{selected.title}</h2>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {viewMode === 'view' ? (
                  <button
                    onClick={() => setViewMode('edit')}
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-gray-800 dark:hover:bg-zinc-200 transition-colors"
                  >
                    <Edit2 size={11} /> Edit
                  </button>
                ) : (
                  <button
                    onClick={() => setViewMode('view')}
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-200 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                  >
                    <Eye size={11} /> Done
                  </button>
                )}
                <button
                  onClick={() => { setSelectedId(null) }}
                  className="p-1.5 rounded-lg text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                  title="Close note"
                >
                  <X size={13} />
                </button>
              </div>
            </div>

            {viewMode === 'edit' ? (
              <JournalEditor
                key={selected.id}
                entryId={selected.id}
                initialContent={selected.content}
                onContentChange={html =>
                  setEntries(prev => prev.map(e => e.id === selected.id ? { ...e, content: html } : e))
                }
              />
            ) : (
              <div
                className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-6 py-5 prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-zinc-200 min-h-[200px]"
                dangerouslySetInnerHTML={{ __html: selected.content || '<p class="text-gray-400">Empty note — click Edit to start writing.</p>' }}
              />
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <FileText size={32} className="text-gray-200 dark:text-zinc-700 mb-3" />
            <p className="text-sm text-gray-500 dark:text-zinc-400 mb-3">Select a note or create a new one</p>
            <button
              onClick={() => openNewNoteForm(DEFAULT_FOLDER)}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-gray-800 dark:hover:bg-zinc-200 transition-colors"
            >
              <PenLine size={12} /> Create first note
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
