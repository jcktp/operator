import { requireMode } from '@/lib/mode-gate'
import ThemesClient from './ThemesClient'

export default async function ThemesPage() {
 await requireMode(['market_research'])
 return <ThemesClient />
}
