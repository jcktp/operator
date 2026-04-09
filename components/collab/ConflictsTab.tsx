'use client'

import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import ConflictCard from './ConflictCard'

interface Conflict {
  id: string
  tableName: string
  recordId: string
  fieldName: string
  localValue: string | null
  remoteValue: string | null
  localPeerId: string | null
  remotePeerId: string | null
  localTimestamp: string | null
  remoteTimestamp: string | null
  resolved: boolean
  resolution: string | null
  resolvedAt: string | null
}

interface Props {
  projectId: string
  initialConflicts: Conflict[]
}

export default function ConflictsTab({ projectId: _projectId, initialConflicts }: Props) {
  const [conflicts, setConflicts] = useState<Conflict[]>(initialConflicts)
  const [showResolved, setShowResolved] = useState(false)

  const unresolved = conflicts.filter(c => !c.resolved)
  const resolved = conflicts.filter(c => c.resolved)
  const visible = showResolved ? conflicts : unresolved

  const handleResolved = (id: string, resolution: string) => {
    setConflicts(cs => cs.map(c => c.id === id ? { ...c, resolved: true, resolution, resolvedAt: new Date().toISOString() } : c))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-zinc-50">Conflicts</p>
          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
            {unresolved.length === 0
              ? 'No unresolved conflicts'
              : `${unresolved.length} unresolved conflict${unresolved.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        {resolved.length > 0 && (
          <button
            onClick={() => setShowResolved(s => !s)}
            className="text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
          >
            {showResolved ? 'Hide resolved' : `Show ${resolved.length} resolved`}
          </button>
        )}
      </div>

      {visible.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <CheckCircle2 size={28} className="text-green-400" />
          <p className="text-sm text-gray-500 dark:text-zinc-400">All conflicts resolved</p>
        </div>
      )}

      <div className="space-y-3">
        {visible.map(c => (
          <ConflictCard key={c.id} conflict={c} onResolved={handleResolved} />
        ))}
      </div>
    </div>
  )
}
