import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import CollabPageClient from './CollabPageClient'

export const dynamic = 'force-dynamic'

export default async function CollabPage() {
  const collabRow = await prisma.setting.findUnique({ where: { key: 'collab_enabled' } })
  const enabled = collabRow?.value === 'true' || process.env.COLLAB_ENABLED === 'true'
  if (!enabled) redirect('/settings')

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
