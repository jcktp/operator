'use client'

import { useState, useCallback } from 'react'
import { Loader2, Save, StickyNote } from 'lucide-react'

interface Props {
  reportId: string
  reportTitle: string
  initialNotes: string | null
  storyName: string | null
  currentProjectId?: string | null
  currentProjectName?: string | null
}

export default function ReportNotesEditor({ reportId, reportTitle, initialNotes, storyName, currentProjectId, currentProjectName }: Props) {
  const [notes, setNotes] = useState(initialNotes ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Track journal entry ID in localStorage so repeated saves update the same entry
  const storageKey = `report-note-entry-${reportId}`
  const [journalEntryId, setJournalEntryId] = useState<string | null>(() => {
    try { return localStorage.getItem(storageKey) } catch { return null }
  })

  const handleSave = useCallback(async () => {
    if (saving) return
    setSaving(true)
    setSaved(false)

    // Save analyst notes to the report record
    await fetch(`/api/reports/${reportId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userNotes: notes }),
    })

    // Also upsert a journal entry in the project folder
    if (notes.trim()) {
      const folder = currentProjectName ?? 'General'
      const entryTitle = `Notes: ${reportTitle}`
      const content = `<p>${notes.trim().replace(/\n/g, '<br/>')}</p>`
      try {
        const res = await fetch('/api/journal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: journalEntryId ?? undefined,
            title: entryTitle,
            folder,
            content,
            projectId: currentProjectId ?? null,
          }),
        })
        if (res.ok) {
          const data = await res.json() as { entry?: { id: string } }
          if (data.entry?.id && !journalEntryId) {
            setJournalEntryId(data.entry.id)
            try { localStorage.setItem(storageKey, data.entry.id) } catch {}
          }
        } else if (journalEntryId) {
          // Stale localStorage ID — clear it and retry as a fresh create
          setJournalEntryId(null)
          try { localStorage.removeItem(storageKey) } catch {}
          const retry = await fetch('/api/journal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: entryTitle, folder, content, projectId: currentProjectId ?? null }),
          })
          if (retry.ok) {
            const data = await retry.json() as { entry?: { id: string } }
            if (data.entry?.id) {
              setJournalEntryId(data.entry.id)
              try { localStorage.setItem(storageKey, data.entry.id) } catch {}
            }
          }
        }
      } catch { /* non-blocking — report save already succeeded */ }
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }, [reportId, reportTitle, notes, saving, journalEntryId, storageKey, currentProjectId, currentProjectName])

  return (
    <section className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
          <StickyNote size={11} />
          Notes
        </h2>
        <div className="flex items-center gap-2">
          {storyName && (
            <span className="text-[10px] font-medium bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 px-2 py-0.5 rounded-full">
              {storyName}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || notes === (initialNotes ?? '')}
            className="flex items-center gap-1 text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-200 disabled:opacity-40 transition-colors"
          >
            {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
            {saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); handleSave() } }}
        placeholder="Add your notes here… (⌘S to save)"
        rows={4}
        className="w-full text-sm text-gray-700 dark:text-zinc-200 bg-transparent placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none resize-none leading-relaxed"
      />
    </section>
  )
}
