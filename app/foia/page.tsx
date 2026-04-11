import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import FoiaClient from './FoiaClient'

export const dynamic = 'force-dynamic'

export default async function FoiaPage() {
 const modeRow = await prisma.setting.findUnique({ where: { key: 'app_mode' } })
 if (modeRow?.value !== 'journalism') notFound()
 return <FoiaClient />
}
