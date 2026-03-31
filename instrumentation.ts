// Next.js instrumentation hook — runs once on server startup (Node.js runtime only).
// Used to recover upload jobs that were left in 'processing' state after a shutdown.

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { kickWorker } = await import('@/lib/upload-queue')
    kickWorker()
  }
}
