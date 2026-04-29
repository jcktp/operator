import type { AppMode } from '@/lib/mode'

/**
 * Server-side guard for mode-gated pages.
 * In journalism-only builds the gate is a no-op; the parameter is kept
 * so existing call sites continue to compile without churn.
 */
export async function requireMode(_modes: AppMode[]): Promise<void> {
  return
}
