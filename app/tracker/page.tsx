import { redirect, notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { isValidSession, SESSION_COOKIE } from '@/lib/auth'
import TrackerShell from './TrackerShell'

export const dynamic = 'force-dynamic'

export default async function TrackerPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!(await isValidSession(token))) redirect('/login')

  const modeRow = await prisma.setting.findUnique({ where: { key: 'app_mode' } })
  if (modeRow?.value !== 'journalism') notFound()

  const { tab } = await searchParams
  const initialTab = (['risks', 'actions', 'foia'] as const).includes(tab as 'risks' | 'actions' | 'foia')
    ? (tab as 'risks' | 'actions' | 'foia')
    : 'claims'

  return <TrackerShell initialTab={initialTab} />
}
