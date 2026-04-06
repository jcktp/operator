import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import type { AppMode } from '@/lib/mode'

/**
 * Server-side guard for mode-gated pages.
 * Calls notFound() if the current app_mode is not in the allowed list.
 */
export async function requireMode(modes: AppMode[]): Promise<void> {
  const setting = await prisma.setting.findUnique({ where: { key: 'app_mode' } })
  const current = (setting?.value ?? 'executive') as AppMode
  if (!modes.includes(current)) notFound()
}
