import { prisma } from '@/lib/db'
import { requireMode } from '@/lib/mode-gate'
import MonitorsClient from './MonitorsClient'

export const dynamic = 'force-dynamic'

export default async function MonitorsPage() {
  await requireMode(['journalism'])

  const currentProject = await prisma.setting.findUnique({ where: { key: 'current_project_id' } })
  return <MonitorsClient projectId={currentProject?.value ?? null} />
}
