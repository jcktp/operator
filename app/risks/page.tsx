import { requireMode } from '@/lib/mode-gate'
import RisksClient from './RisksClient'

export default async function RisksPage() {
 await requireMode(['executive', 'legal'])
 return <RisksClient />
}
