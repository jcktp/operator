import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import NetworkClient from './NetworkClient'

export const dynamic = 'force-dynamic'

export default async function NetworkPage() {
 const modeRow = await prisma.setting.findUnique({ where: { key: 'app_mode' } })
 if (modeRow?.value !== 'journalism') notFound()
 return <NetworkClient />
}
