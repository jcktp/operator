import { requireMode } from '@/lib/mode-gate'
import PoliciesClient from './PoliciesClient'

export default async function PoliciesPage() {
 await requireMode(['human_resources'])
 return <PoliciesClient />
}
