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
      .catch(() => setLoaded(true))
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
    router.refresh()
  }

  const currentProject = projects.find(p => p.id === currentProjectId) ?? null
  const activeProjects = projects.filter(p => p.status === 'in_progress')

  if (!loaded) return null

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(s => !s)}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors max-w-[160px]',
          open
            ? 'bg-white/15 text-white'
            : 'text-white/55 hover:text-white hover:bg-white/10'
        )}
        title="Switch project"
      >
        <FolderOpen size={12} className="shrink-0" />
        <span className="truncate">
          {currentProject ? currentProject.name : `All ${modeConfig.projectLabelPlural.toLowerCase()}`}
        </span>
        <ChevronDown size={10} className="shrink-0 opacity-60" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-[4px] shadow-lg py-1 min-w-[200px] z-50">
          {activeProjects.length > 0 && (
            <p className="px-3 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
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
                    ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-100'
                    : 'text-gray-700 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-700'
                )}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', isCurrent ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-zinc-600')} />
                  <span className="truncate font-medium">{p.name}</span>
                </span>
                {isCurrent && (
                  <span className="ml-2 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-indigo-500 dark:text-indigo-400">
                    Active
                  </span>
                )}
              </button>
            )
          })}

          {activeProjects.length === 0 && (
            <p className="px-3 py-2 text-xs text-gray-400 dark:text-zinc-500 italic">No active {modeConfig.projectLabelPlural.toLowerCase()}</p>
          )}

          <div className="mx-2 my-1 h-px bg-gray-100 dark:bg-zinc-800" />

          <button
            onClick={() => { setOpen(false); router.push('/projects') }}
            className="flex items-center gap-2 w-full px-3 py-2 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-950 transition-colors"
          >
            <Plus size={11} />
            Manage {modeConfig.projectLabelPlural.toLowerCase()}
          </button>
        </div>
      )}
    </div>
  )
}
