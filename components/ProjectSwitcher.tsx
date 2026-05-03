'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, FolderOpen, Plus, Check } from 'lucide-react'
import { useMode } from '@/components/ModeContext'
import { cn } from '@/lib/utils'

interface Project {
  id: string
  name: string
  area: string
  status: string
}

interface ApiResponse {
  projects: Project[]
  currentProjectId: string | null
}

export default function ProjectSwitcher() {
  const router = useRouter()
  const modeConfig = useMode()
  const [open, setOpen] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const fetchProjects = () => {
    fetch('/api/projects')
      .then(r => r.json())
      .then((d: ApiResponse) => {
        setProjects(d.projects ?? [])
        setCurrentProjectId(d.currentProjectId ?? null)
        setLoaded(true)
      })
      .catch((err) => { console.error('Failed to load projects:', err); setLoaded(true) })
  }

  useEffect(() => {
    fetchProjects()
    window.addEventListener('project:changed', fetchProjects)
    return () => window.removeEventListener('project:changed', fetchProjects)
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const switchTo = async (id: string | null) => {
    setOpen(false)
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'current_project_id', value: id ?? '' }),
    })
    setCurrentProjectId(id)
    window.dispatchEvent(new Event('project:changed'))
    // Navigate to the story workspace so the dropdown and the Stories nav show the same view
    if (id) {
      router.push(`/stories/${id}`)
    } else {
      router.push('/stories')
    }
  }

  const currentProject = projects.find(p => p.id === currentProjectId) ?? null
  const activeProjects = projects.filter(p => p.status === 'in_progress')

  if (!loaded) return null

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(s => !s)}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors max-w-[160px]',
          open
            ? 'bg-white/15 text-white'
            : 'text-white/55 hover:text-white hover:bg-white/10'
        )}
        title="Switch project"
        aria-label="Switch project"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <FolderOpen size={12} className="shrink-0" />
        <span className="truncate">
          {currentProject ? currentProject.name : `All ${modeConfig.projectLabelPlural.toLowerCase()}`}
        </span>
        <ChevronDown size={10} className="shrink-0 opacity-60" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-[4px] shadow-lg py-1 min-w-[200px] z-50">
          {activeProjects.length > 0 && (
            <p className="px-3 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Active {modeConfig.projectLabelPlural.toLowerCase()}
            </p>
          )}

          {activeProjects.map(p => {
            const isCurrent = p.id === currentProjectId
            return (
              <button
                key={p.id}
                onClick={() => switchTo(p.id)}
                className={cn(
                  'flex items-center justify-between w-full px-3 py-2 text-xs transition-colors',
                  isCurrent
                    ? 'bg-[var(--blue-dim)] text-[var(--text-bright)]'
                    : 'text-[var(--text-body)] hover:bg-[var(--surface-2)]'
                )}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', isCurrent ? 'bg-[var(--blue)]' : 'bg-[var(--border)]')} />
                  <span className="truncate font-medium">{p.name}</span>
                </span>
                {isCurrent && (
                  <span className="ml-2 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-[var(--blue)]">
                    Active
                  </span>
                )}
              </button>
            )
          })}

          {activeProjects.length === 0 && (
            <p className="px-3 py-2 text-xs text-[var(--text-muted)] italic">No active {modeConfig.projectLabelPlural.toLowerCase()}</p>
          )}

          <div className="mx-2 my-1 h-px bg-[var(--border)]" />

          <button
            onClick={() => { setOpen(false); router.push('/stories') }}
            className="flex items-center gap-2 w-full px-3 py-2 text-xs text-[var(--blue)] hover:bg-[var(--blue-dim)] transition-colors"
          >
            <Plus size={11} />
            All {modeConfig.projectLabelPlural.toLowerCase()} →
          </button>
        </div>
      )}
    </div>
  )
}
