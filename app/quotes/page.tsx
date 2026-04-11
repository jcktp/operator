import { requireMode } from '@/lib/mode-gate'
import QuotesClient from './QuotesClient'

export default async function QuotesPage() {
 await requireMode(['market_research'])
 return <QuotesClient />
}
