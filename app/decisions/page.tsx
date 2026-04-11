import { requireMode } from '@/lib/mode-gate'
import DecisionsClient from './DecisionsClient'

export default async function DecisionsPage() {
 await requireMode(['executive'])
 return <DecisionsClient />
}
