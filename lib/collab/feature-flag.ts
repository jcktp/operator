import { prisma } from '@/lib/db'

/**
 * Returns true when collaboration is enabled.
 * Reads from the DB setting `collab_enabled` (set via Settings → Collab).
 * Falls back to COLLAB_ENABLED env var so existing .env.local setups keep working.
 */
export async function isCollabEnabled(): Promise<boolean> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: 'collab_enabled' } })
    if (row) return row.value === 'true'
  } catch {
    // DB not ready yet (e.g. during build) — fall through to env
  }
  return process.env.COLLAB_ENABLED === 'true'
}

/** Returns a 404 Response when collab is disabled — use in route handlers. */
export async function requireCollabEnabled(): Promise<Response | null> {
  if (!(await isCollabEnabled())) {
    return Response.json({ error: 'Collaboration is not enabled' }, { status: 404 })
  }
  return null
}
