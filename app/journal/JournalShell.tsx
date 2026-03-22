'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, FolderOpen, FileText, Trash2, ChevronRight, ChevronDown, Edit2 } from 'lucide-react'
import JournalEditor from './JournalEditor'

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

export default function JournalShell({ entries: initial }: Props) {
  const [entries, setEntries] = useState(initial)
  const [selectedId, setSelectedId] = useState<string | null>(initial[0]?.id ?? null)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(initial.map(e => e.folder))
  )
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newFolder, setNewFolder] = useState('General')
  const [editingTitle, setEditingTitle] = useState<string | null>(null)
  const [editTitleValue, setEditTitleValue] = useState('')
  const router = useRouter()

  const folders = [...new Set(entries.map(e => e.folder))].sort()
  const selected = entries.find(e => e.id === selectedId)

  const toggleFolder = (f: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(f)) next.delete(f); else next.add(f)
      return next
    })
  }

  const createNote = async () => {
    if (!newTitle.trim()) return
    const res = await fetch('/api/journal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle.trim(), folder: newFolder || 'General', content: '' }),
    })
    const data = await res.json()
    const entry: JournalEntry = {
      id: data.entry.id,
      title: data.entry.title,
      folder: data.entry.folder,
      content: data.entry.content,
      updatedAt: data.entry.updatedAt,
    }
    setEntries(prev => [entry, ...prev])
    setSelectedId(entry.id)
    setExpandedFolders(prev => new Set([...prev, entry.folder]))
    setCreating(false)
    setNewTitle('')
    setNewFolder('General')
  }

  const deleteNote = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await fetch('/api/journal', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setEntries(prev => prev.filter(e => e.id !== id))
    if (selectedId === id) setSelectedId(entries.find(e => e.id !== id)?.id ?? null)
  }

  const renameNote = async (id: string) => {
    if (!editTitleValue.trim()) { setEditingTitle(null); return }
    await fetch('/api/journal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, title: editTitleValue.trim() }),
    })
    setEntries(prev => prev.map(e => e.id === id ? { ...e, title: editTitleValue.trim() } : e))
    setEditingTitle(null)
  }

  const allFolders = [...new Set([...folders, 'General', 'Work', 'Personal'])]

  return (
    <div className="flex gap-0 items-start h-[calc(100vh-140px)] min-h-[500px]">
      {/* Sidebar */}
      <div className="w-60 shrink-0 border-r border-gray-200 h-full overflow-y-auto pr-2">
        <div className="flex items-center justify-between mb-3 pr-1">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Notes</span>
          <button
            onClick={() => setCreating(true)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            title="New note"
          >
            <Plus size={13} />
          </button>
        </div>

        {/* New note form */}
        {creating && (
          <div className="mb-3 space-y-1.5 bg-gray-50 rounded-xl p-3">
            <input
              autoFocus
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createNote(); if (e.key === 'Escape') setCreating(false) }}
              placeholder="Note title"
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
            <select value={newFolder} onChange={e => setNewFolder(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none bg-white">
              {allFolders.map(f => <option key={f} value={f}>{f}</option>)}
              <option value="__new__">+ New folder…</option>
            </select>
            {newFolder === '__new__' && (
              <input
                autoFocus
                placeholder="Folder name"
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-900"
                onBlur={e => setNewFolder(e.target.value || 'General')}
              />
            )}
            <div className="flex gap-1">
              <button onClick={createNote} disabled={!newTitle.trim()}
                className="flex-1 text-xs bg-gray-900 text-white rounded-lg py-1 hover:bg-gray-800 transition-colors disabled:opacity-40">
                Create
              </button>
              <button onClick={() => setCreating(false)}
                className="flex-1 text-xs border border-gray-200 text-gray-600 rounded-lg py-1 hover:bg-gray-100 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        {entries.length === 0 && !creating && (
          <div className="text-center py-8 text-xs text-gray-400">
            <FileText size={20} className="mx-auto mb-2 opacity-30" />
            No notes yet
          </div>
        )}

        {/* Folders */}
        {folders.map(folder => {
          const folderEntries = entries.filter(e => e.folder === folder)
          const isExpanded = expandedFolders.has(folder)
          return (
            <div key={folder} className="mb-1">
              <button
                onClick={() => toggleFolder(folder)}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-left hover:bg-gray-100 transition-colors group"
              >
                {isExpanded ? <ChevronDown size={11} className="text-gray-400 shrink-0" /> : <ChevronRight size={11} className="text-gray-400 shrink-0" />}
                <FolderOpen size={12} className="text-amber-400 shrink-0" />
                <span className="text-xs font-medium text-gray-700 truncate flex-1">{folder}</span>
                <span className="text-[10px] text-gray-400">{folderEntries.length}</span>
              </button>

              {isExpanded && (
                <div className="ml-4 space-y-0.5">
                  {folderEntries.map(entry => (
                    <div
                      key={entry.id}
                      onClick={() => setSelectedId(entry.id)}
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer group transition-colors ${
                        selectedId === entry.id
                          ? 'bg-gray-900 text-white'
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      <FileText size={11} className={`shrink-0 ${selectedId === entry.id ? 'text-gray-400' : 'text-gray-400'}`} />
                      {editingTitle === entry.id ? (
                        <input
                          autoFocus
                          value={editTitleValue}
                          onChange={e => setEditTitleValue(e.target.value)}
                          onBlur={() => renameNote(entry.id)}
                          onKeyDown={e => { if (e.key === 'Enter') renameNote(entry.id); if (e.key === 'Escape') setEditingTitle(null) }}
                          onClick={e => e.stopPropagation()}
                          className="flex-1 text-xs bg-transparent border-b border-gray-400 outline-none"
                        />
                      ) : (
                        <span className={`text-xs truncate flex-1 ${selectedId === entry.id ? 'text-white' : 'text-gray-700'}`}>
                          {entry.title}
                        </span>
                      )}
                      <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={e => { e.stopPropagation(); setEditingTitle(entry.id); setEditTitleValue(entry.title) }}
                          className={`p-0.5 rounded ${selectedId === entry.id ? 'text-gray-400 hover:text-white' : 'text-gray-400 hover:text-gray-700'}`}
                        >
                          <Edit2 size={9} />
                        </button>
                        <button
                          onClick={e => deleteNote(entry.id, e)}
                          className={`p-0.5 rounded ${selectedId === entry.id ? 'text-gray-400 hover:text-red-400' : 'text-gray-400 hover:text-red-500'}`}
                        >
                          <Trash2 size={9} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Editor */}
      <div className="flex-1 min-w-0 h-full overflow-y-auto pl-6">
        {selected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{selected.folder}</span>
              <span className="text-xs text-gray-300">/</span>
              <h2 className="text-sm font-semibold text-gray-900">{selected.title}</h2>
            </div>
            <JournalEditor
              key={selected.id}
              entryId={selected.id}
              initialContent={selected.content}
              onContentChange={html => {
                setEntries(prev => prev.map(e => e.id === selected.id ? { ...e, content: html } : e))
              }}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <FileText size={32} className="text-gray-200 mb-3" />
            <p className="text-sm text-gray-500 mb-1">No note selected</p>
            <button onClick={() => setCreating(true)}
              className="text-xs text-gray-500 hover:text-gray-900 underline">
              Create your first note
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
