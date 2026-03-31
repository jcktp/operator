'use client'

import { useState, useCallback } from 'react'
import { Loader2, Save, StickyNote } from 'lucide-react'

interface Props {
  reportId: string
  initialNotes: string | null
  storyName: string | null
}

export default function ReportNotesEditor({ reportId, initialNotes, storyName }: Props) {
  const [notes, setNotes] = useState(initialNotes ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = useCallback(async () => {
    if (saving) return
    setSaving(true)
    setSaved(false)
    await fetch(`/api/reports/${reportId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userNotes: notes }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }, [reportId, notes, saving])

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
