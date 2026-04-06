import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import FileCleanerClient from './FileCleanerClient'

export const dynamic = 'force-dynamic'

export default async function FileCleanerPage() {
  const modeRow = await prisma.setting.findUnique({ where: { key: 'app_mode' } })
  if (modeRow?.value !== 'journalism') notFound()

  return <FileCleanerClient />
}
