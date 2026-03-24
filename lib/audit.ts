import { prisma } from './db'

export async function logAction(action: string, detail?: string): Promise<void> {
  try {
    await prisma.auditLog.create({ data: { action, detail: detail ?? null } })
  } catch (e) {
    console.warn('Audit log write failed:', e)
  }
}
