import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import ClaimsClient from './ClaimsClient'

export const dynamic = 'force-dynamic'

export default async function ClaimsPage() {
 const modeRow = await prisma.setting.findUnique({ where: { key: 'app_mode' } })
 if (modeRow?.value !== 'journalism') notFound()
 return <ClaimsClient />
}
