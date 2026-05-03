import { redirect } from 'next/navigation'

// Web Monitor is now under Research (/research?tab=monitor)
export default function MonitorsPage() {
  redirect('/research?tab=monitor')
}
