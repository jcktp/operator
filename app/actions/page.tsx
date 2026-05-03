import { redirect } from 'next/navigation'

// Actions now lives under the unified Tracker (/tracker?tab=actions).
export default function ActionsPage() {
  redirect('/tracker?tab=actions')
}
