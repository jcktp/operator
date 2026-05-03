import { redirect } from 'next/navigation'

// Claims now lives under the unified Tracker (/tracker?tab=claims).
// This redirect preserves any existing bookmarks and internal links to /claims.
export default function ClaimsPage() {
  redirect('/tracker?tab=claims')
}
