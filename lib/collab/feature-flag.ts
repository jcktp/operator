/** Returns true when COLLAB_ENABLED=true is set in the environment. */
export function isCollabEnabled(): boolean {
  return process.env.COLLAB_ENABLED === 'true'
}

/** Throws a plain Response (404) when collab is disabled — use in route handlers. */
export function requireCollabEnabled(): Response | null {
  if (!isCollabEnabled()) {
    return Response.json({ error: 'Collaboration is not enabled' }, { status: 404 })
  }
  return null
}
