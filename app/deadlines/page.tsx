import { requireMode } from '@/lib/mode-gate'
import DeadlinesClient from './DeadlinesClient'

export default async function DeadlinesPage() {
 await requireMode(['legal', 'human_resources'])
 return <DeadlinesClient />
}
