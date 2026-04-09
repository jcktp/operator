// Next.js instrumentation hook — runs once on server startup (Node.js runtime only).

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // ── Upload worker recovery ─────────────────────────────────────────────────
  const { kickWorker } = await import('@/lib/upload-queue')
  kickWorker()

  // ── Collaboration layer (only when COLLAB_ENABLED=true) ───────────────────
  if (process.env.COLLAB_ENABLED !== 'true') return

  try {
    const { getOrCreateIdentity } = await import('@/lib/collab/identity')
    const { startMdns } = await import('@/lib/collab/mdns')
    const { pushToAllPeers } = await import('@/lib/collab/sync')
    const { prisma } = await import('@/lib/db')

    const identity = await getOrCreateIdentity()
    console.log(`[collab] Identity ready: ${identity.id}`)

    // mDNS — discover local network peers
    await startMdns(
      identity.id,
      identity.displayName,
      async () => {
        const shares = await prisma.projectShare.findMany({ select: { projectId: true } })
        return [...new Set(shares.map(s => s.projectId))]
      }
    )

    // Periodic sync — push local changes to all trusted peers every 60 s
    setInterval(async () => {
      try {
        const sharedProjects = await prisma.projectShare.findMany({
          select: { projectId: true },
          distinct: ['projectId'],
        })
        for (const { projectId } of sharedProjects) {
          await pushToAllPeers(projectId)
        }
      } catch (err) {
        console.error('[collab] Periodic sync error:', err)
      }
    }, 60_000)
  } catch (err) {
    console.error('[collab] Failed to initialise collaboration layer:', err)
  }
}
