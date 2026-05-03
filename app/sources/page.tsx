import { redirect } from 'next/navigation'

// /sources is the canonical entry point for the consolidated Sources surface (C9).
// It defaults to the Library tab; the SourcesTabs component on the destination
// renders the tabbed nav so users can switch to Filesystem or Add Source.
export default function SourcesPage() {
  redirect('/library')
}
