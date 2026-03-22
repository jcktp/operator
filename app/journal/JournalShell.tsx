'use client'

import { useState } from 'react'
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
  const [newNoteFolder, setNewNoteFolder] = useState<string | null>(null) // folder for pending new note
  const [newTitle, setNewTitle] = useState('')
  const [newFolderName, setNewFolderName] = useState('')
  const [editingTitle, setEditingTitle] = useState<string | null>(null)
  const [editTitleValue, setEditTitleValue] = useState('')

  const folders = [...new Set(entries.map(e => e.folder))].sort()
  const selected = entries.find(e => e.id === selectedId)

  const toggleFolder = (f: string) =>
    setExpandedFolders(prev => { const s = new Set(prev); s.has(f) ? s.delete(f) : s.add(f); return s })

  const startNewNote = (folder: string) => {
    setNewNoteFolder(folder)
    setNewTitle('')
    setExpandedFolders(prev => new Set([...prev, folder]))
  }

  const createNote = async () => {
    const title = newTitle.trim() || 'Untitled'
    const folder = newNoteFolder ?? 'General'
    const res = await fetch('/api/journal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, folder, content: '' }),
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
    setNewNoteFolder(null)
    setNewTitle('')
  }

  const createFolder = async () => {
    const folder = newFolderName.trim()
    if (!folder) return
    // Create a first note in the new folder
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
    setExpandedFolders(prev => new Set([...prev, folder]))
    setNewFolderName('')
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

  const allFolderNames = folders.length > 0 ? folders : ['General']

  return (
    <div className="flex gap-0 items-start h-[calc(100vh-140px)] min-h-[500px]">
      {/* Sidebar */}
      <div className="w-60 shrink-0 border-r border-gray-200 h-full overflow-y-auto pb-4" style={{ paddingRight: '0.5rem' }}>
        <div className="flex items-center justify-between mb-3 pr-1">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Notes</span>
        </div>

        {/* New folder input */}
        <div className="flex gap-1 mb-3">
          <input
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createFolder() }}
            placeholder="New folder…"
            className="flex-1 text-xs border border-dashed border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-300 placeholder-gray-400 min-w-0"
          />
          {newFolderName.trim() && (
            <button
              onClick={createFolder}
              className="shrink-0 text-xs px-2 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              <Plus size={12} />
            </button>
          )}
        </div>

        {entries.length === 0 && !newFolderName && (
          <div className="text-center py-8 text-xs text-gray-400">
            <FileText size={20} className="mx-auto mb-2 opacity-30" />
            Type a folder name above to start
          </div>
        )}

        {/* Folders */}
        {allFolderNames.map(folder => {
          const folderEntries = entries.filter(e => e.folder === folder)
          const isExpanded = expandedFolders.has(folder)
          return (
            <div key={folder} className="mb-1">
              <div className="flex items-center group">
                <button
                  onClick={() => toggleFolder(folder)}
                  className="flex items-center gap-1.5 flex-1 px-2 py-1.5 rounded-lg text-left hover:bg-gray-100 transition-colors min-w-0"
                >
                  {isExpanded
                    ? <ChevronDown size={11} className="text-gray-400 shrink-0" />
                    : <ChevronRight size={11} className="text-gray-400 shrink-0" />}
                  <FolderOpen size={12} className="text-amber-400 shrink-0" />
                  <span className="text-xs font-medium text-gray-700 truncate flex-1">{folder}</span>
                  <span className="text-[10px] text-gray-400 shrink-0">{folderEntries.length}</span>
                </button>
                <button
                  onClick={() => startNewNote(folder)}
                  className="shrink-0 p-1 text-gray-400 hover:text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity rounded"
                  title="New note in folder"
                >
                  <Plus size={11} />
                </button>
              </div>

              {isExpanded && (
                <div className="ml-4 space-y-0.5">
                  {/* Inline new note form */}
                  {newNoteFolder === folder && (
                    <div className="flex gap-1 py-1">
                      <input
                        autoFocus
                        value={newTitle}
                        onChange={e => setNewTitle(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') createNote()
                          if (e.key === 'Escape') setNewNoteFolder(null)
                        }}
                        placeholder="Note title…"
                        className="flex-1 text-xs border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-900 min-w-0"
                      />
                      <button onClick={createNote} className="shrink-0 text-xs px-1.5 py-1 bg-gray-900 text-white rounded-lg hover:bg-gray-800">
                        <Plus size={11} />
                      </button>
                    </div>
                  )}

                  {folderEntries.map(entry => (
                    <div
                      key={entry.id}
                      onClick={() => setSelectedId(entry.id)}
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer group transition-colors ${
                        selectedId === entry.id ? 'bg-gray-900' : 'hover:bg-gray-100'
                      }`}
                    >
                      <FileText size={11} className="shrink-0 text-gray-400" />
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
                          className="flex-1 text-xs bg-transparent border-b border-gray-400 outline-none min-w-0"
                        />
                      ) : (
                        <span className={`text-xs truncate flex-1 min-w-0 ${selectedId === entry.id ? 'text-white' : 'text-gray-700'}`}>
                          {entry.title}
                        </span>
                      )}
                      <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            setEditingTitle(entry.id)
                            setEditTitleValue(entry.title)
                          }}
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

                  {folderEntries.length === 0 && newNoteFolder !== folder && (
                    <button
                      onClick={() => startNewNote(folder)}
                      className="w-full text-left text-[10px] text-gray-400 px-2 py-1 hover:text-gray-600 transition-colors"
                    >
                      + New note
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Editor panel */}
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
              onContentChange={html =>
                setEntries(prev => prev.map(e => e.id === selected.id ? { ...e, content: html } : e))
              }
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <FileText size={32} className="text-gray-200 mb-3" />
            <p className="text-sm text-gray-500 mb-1">No note selected</p>
            <p className="text-xs text-gray-400">Type a folder name in the sidebar to create your first note</p>
          </div>
        )}
      </div>
    </div>
  )
}
