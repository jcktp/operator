import { redirect } from 'next/navigation'

// Risks now lives under the unified Tracker (/tracker?tab=risks).
export default function RisksPage() {
  redirect('/tracker?tab=risks')
}
