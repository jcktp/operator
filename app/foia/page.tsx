import { redirect } from 'next/navigation'

// FOIA is now a tab inside the unified Tracker page.
export default function FoiaPage() {
  redirect('/tracker?tab=foia')
}
