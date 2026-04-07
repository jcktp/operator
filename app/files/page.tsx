import { readdirSync, statSync, existsSync } from 'fs'
import { join, extname } from 'path'
import { getReportsRoot } from '@/lib/reports-folder'
import { prisma } from '@/lib/db'
import { sanitizeProjectName } from '@/lib/reports-folder'
import FilesClient from './FilesClient'
import type { DirEntry } from '@/lib/files-types'

function listDir(dir: string): DirEntry[] {
  if (!existsSync(dir)) return []
  const entries: DirEntry[] = []
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.')) continue
    const abs = join(dir, name)
    let st
    try { st = statSync(abs) } catch { continue }
    if (st.isDirectory()) {
      entries.push({ name, type: 'dir', modifiedAt: st.mtime.toISOString() })
    } else {
      entries.push({
        name,
        type: 'file',
        size: st.size,
        modifiedAt: st.mtime.toISOString(),
        ext: extname(name).replace('.', '').toLowerCase(),
      })
    }
  }
  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  return entries
}

export default async function FilesPage() {
  const root = getReportsRoot()
  const allEntries = listDir(root)

  // Fetch project names for the current mode
  const modeRow = await prisma.setting.findUnique({ where: { key: 'app_mode' } })
  const currentMode = modeRow?.value ?? ''
  const projects = await prisma.project.findMany({
    where: currentMode ? { mode: currentMode } : {},
    select: { name: true },
  })
  const projectFolderNames = new Set(projects.map(p => sanitizeProjectName(p.name)))

  // Filter root entries to only show folders belonging to the current mode's projects,
  // plus the "General" folder (used for reports not scoped to a project).
  // Files within those folders are not filtered — the full subtree is accessible.
  const initialEntries = currentMode
    ? allEntries.filter(e => e.name === 'General' || projectFolderNames.has(e.name))
    : allEntries

  return <FilesClient initialEntries={initialEntries} projectFolderNames={projectFolderNames} />
}
