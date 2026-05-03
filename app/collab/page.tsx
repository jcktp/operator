import Link from 'next/link'
import { prisma } from '@/lib/db'
import { Users, ArrowRight } from 'lucide-react'
import CollabPageClient from './CollabPageClient'

export const dynamic = 'force-dynamic'

export default async function CollabPage() {
 const collabRow = await prisma.setting.findUnique({ where: { key: 'collab_enabled' } })
 const enabled = collabRow?.value === 'true' || process.env.COLLAB_ENABLED === 'true'
 if (!enabled) {
   return (
     <div className="flex flex-1 min-h-0 items-center justify-center">
       <div className="max-w-md text-center px-6">
         <div className="w-12 h-12 mx-auto bg-[var(--blue-dim)] rounded-[10px] flex items-center justify-center mb-4">
           <Users size={20} className="text-[var(--blue)]" />
         </div>
         <h1 className="text-xl font-semibold text-[var(--text-bright)] mb-2">Collab is off</h1>
         <p className="text-sm text-[var(--text-muted)] leading-relaxed mb-6">
           Connect with peers to share projects, sync evidence, chat in-app, and resolve conflicts. Everything stays peer-to-peer — no cloud account required.
         </p>
         <Link
           href="/settings?tab=collab"
           className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-full bg-[var(--ink)] text-[var(--ink-contrast)] hover:opacity-90 transition-colors"
         >
           Enable Collab in Settings
           <ArrowRight size={14} />
         </Link>
       </div>
     </div>
   )
 }

 const [projects, peers, lanOnlyRow] = await Promise.all([
 prisma.project.findMany({
 orderBy: { updatedAt: 'desc' },
 select: { id: true, name: true, area: true, status: true },
 }),
 prisma.peer.findMany({ orderBy: { createdAt: 'asc' } }),
 prisma.setting.findUnique({ where: { key: 'collab_lan_only' } }),
 ])

 return (
 <CollabPageClient
 initialProjects={projects.map(p => ({ id: p.id, name: p.name, area: p.area, status: p.status }))}
 initialPeers={peers.map(p => ({
 id: p.id,
 displayName: p.displayName,
 trusted: p.trusted,
 lastSeen: p.lastSeen?.toISOString() ?? null,
 tunnelUrl: p.tunnelUrl,
 localUrl: p.localUrl,
 discoveryMethod: p.discoveryMethod,
 publicKey: p.publicKey,
 }))}
 initialLanOnly={lanOnlyRow?.value === 'true'}
 />
 )
}
