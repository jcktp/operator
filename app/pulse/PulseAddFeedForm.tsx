'use client'

import { Loader2 } from 'lucide-react'
import { TypeDropdown } from './PulseDropdowns'
import Input from '@/components/ui/Input'

const TYPE_HINT: Record<string, string> = {
 rss: 'RSS or Atom feed URL',
 reddit: 'Subreddit name or URL — e.g. r/news',
 youtube: 'YouTube channel URL or channel ID starting with UC',
 bluesky: 'Handle (e.g. you.bsky.social) for public posts, or type"timeline"for your home feed (requires credentials in Settings → AI → Social)',
 mastodon: '@user@instance.social for a public profile, or just instance domain (e.g. mastodon.social) for your home timeline (requires token in Settings → AI → Social)',
 webhook: 'URL returning JSON array of { title, url, summary, publishedAt }',
}

const TYPE_PLACEHOLDER: Record<string, string> = {
 rss: 'https://example.com/feed.xml',
 reddit: 'r/MachineLearning',
 youtube: 'youtube.com/channel/UC…',
 bluesky: 'you.bsky.social or timeline',
 mastodon: '@you@mastodon.social or mastodon.social',
 webhook: 'https://example.com/webhook',
}

interface Props {
 form: { name: string; url: string; type: string }
 setForm: React.Dispatch<React.SetStateAction<{ name: string; url: string; type: string }>>
 onSubmit: (e: React.FormEvent) => void
 adding: boolean
 bskyConfigured: boolean
}

export default function PulseAddFeedForm({ form, setForm, onSubmit, adding, bskyConfigured }: Props) {
 return (
 <form onSubmit={onSubmit} className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-5 space-y-4">
 <h2 className="text-sm font-semibold text-[var(--text-bright)]">Add feed</h2>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Name *</label>
 <Input
 type="text"
 value={form.name}
 onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
 required
 placeholder="Hacker News"
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Type *</label>
 <TypeDropdown value={form.type} onChange={v => setForm(f => ({
 ...f,
 type: v,
 url: v === 'bluesky' && bskyConfigured ? 'timeline' : f.url,
 }))} />
 </div>
 </div>
 <div>
 <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">
 {form.type === 'twitter' ? 'Username *' : 'URL *'}
 </label>
 <Input
 type="text"
 value={form.url}
 onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
 required
 placeholder={TYPE_PLACEHOLDER[form.type] ?? 'https://…'}
 />
 {form.type === 'bluesky' ? (
 bskyConfigured ? (
 <p className="text-xs text-[var(--green)] mt-1">Bluesky credentials configured. <span className="text-[var(--text-muted)]">Use <code className="font-mono">timeline</code> for your home feed, or enter any handle for a public profile.</span></p>
 ) : (
 <p className="text-xs mt-1">
 <span className="text-[var(--amber)] font-medium">No Bluesky credentials set.</span>
 <span className="text-[var(--text-muted)]"> For your home timeline, <a href="/settings"className="underline text-[var(--text-subtle)] hover:text-[var(--text-bright)]">add your handle and app password in Settings → Pulse</a>. Public profile feeds work without credentials.</span>
 </p>
 )
 ) : (
 <p className="text-xs text-[var(--text-muted)] mt-1">{TYPE_HINT[form.type]}</p>
 )}
 </div>
 <button
 type="submit"
 disabled={adding}
 className="bg-[var(--ink)] text-[var(--ink-contrast)] text-xs font-medium h-7 px-3 rounded-[4px] hover:bg-[var(--ink)] disabled:opacity-50 flex items-center gap-2"
 >
 {adding && <Loader2 size={13} className="animate-spin" />}
 {adding ? 'Fetching…' : 'Add feed'}
 </button>
 </form>
 )
}
