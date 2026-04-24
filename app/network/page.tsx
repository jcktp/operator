import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getModeConfig } from '@/lib/mode'
import NetworkClient from './NetworkClient'

export const dynamic = 'force-dynamic'

export default async function NetworkPage() {
 const modeRow = await prisma.setting.findUnique({ where: { key: 'app_mode' } })
 const modeConfig = getModeConfig(modeRow?.value)
 if (!modeConfig.features.entities) notFound()
 return <NetworkClient />
}
