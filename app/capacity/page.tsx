import { requireMode } from '@/lib/mode-gate'
import CapacityClient from './CapacityClient'

export default async function CapacityPage() {
 await requireMode(['human_resources'])
 return <CapacityClient />
}
