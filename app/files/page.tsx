import { readdirSync, statSync, existsSync } from 'fs'
import { join, extname } from 'path'
import { getReportsRoot } from '@/lib/reports-folder'
import { prisma } from '@/lib/db'
import { sanitizeProjectName } from '@/lib/reports-folder'
import FilesClient from './FilesClient'
import SourcesTabs from '@/components/SourcesTabs'
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

 const projects = await prisma.project.findMany({ select: { name: true } })
 const projectFolderNames = new Set(projects.map(p => sanitizeProjectName(p.name)))

 // Filter root entries to project folders + "General".
 const initialEntries = allEntries.filter(e => e.name === 'General' || projectFolderNames.has(e.name))

 return (
   <div>
     <div className="sticky top-[88px] z-20 bg-[var(--background)] py-5 -mx-6 px-6 sm:-mx-8 sm:px-8 mb-3">
       <div className="mb-2">
         <h1 className="text-2xl font-semibold text-[var(--text-bright)]">Sources</h1>
         <p className="text-[var(--text-muted)] text-sm mt-0.5">Raw filesystem view of uploaded source materials.</p>
       </div>
       <SourcesTabs active="filesystem" />
     </div>
     <FilesClient initialEntries={initialEntries} projectFolderNames={projectFolderNames} />
   </div>
 )
}
