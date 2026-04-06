import { requireMode } from '@/lib/mode-gate'
import ActionsClient from './ActionsClient'

export default async function ActionsPage() {
  await requireMode(['team_lead', 'human_resources'])
  return <ActionsClient />
}
