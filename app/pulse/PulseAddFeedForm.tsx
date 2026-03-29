'use client'

import { Loader2 } from 'lucide-react'
import { TypeDropdown } from './PulseDropdowns'

const TYPE_HINT: Record<string, string> = {
  rss:      'RSS or Atom feed URL',
  reddit:   'Subreddit name or URL — e.g. r/news',
  youtube:  'YouTube channel URL or channel ID starting with UC',
  bluesky:  'Handle (e.g. you.bsky.social) for public posts, or type "timeline" for your home feed (requires credentials in Settings → AI → Social)',
  mastodon: '@user@instance.social for a public profile, or just instance domain (e.g. mastodon.social) for your home timeline (requires token in Settings → AI → Social)',
  webhook:  'URL returning JSON array of { title, url, summary, publishedAt }',
}

const TYPE_PLACEHOLDER: Record<string, string> = {
  rss:      'https://example.com/feed.xml',
  reddit:   'r/MachineLearning',
  youtube:  'youtube.com/channel/UC…',
  bluesky:  'you.bsky.social  or  timeline',
  mastodon: '@you@mastodon.social  or  mastodon.social',
  webhook:  'https://example.com/webhook',
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
    <form onSubmit={onSubmit} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-5 space-y-4">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-zinc-50">Add feed</h2>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            required
            placeholder="Hacker News"
            className="w-full border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">Type *</label>
          <TypeDropdown value={form.type} onChange={v => setForm(f => ({
            ...f,
            type: v,
            url: v === 'bluesky' && bskyConfigured ? 'timeline' : f.url,
          }))} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          {form.type === 'twitter' ? 'Username *' : 'URL *'}
        </label>
        <input
          type="text"
          value={form.url}
          onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
          required
          placeholder={TYPE_PLACEHOLDER[form.type] ?? 'https://…'}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
        {form.type === 'bluesky' ? (
          bskyConfigured ? (
            <p className="text-xs text-green-600 mt-1">Bluesky credentials configured. <span className="text-gray-400">Use <code className="font-mono">timeline</code> for your home feed, or enter any handle for a public profile.</span></p>
          ) : (
            <p className="text-xs mt-1">
              <span className="text-amber-600 font-medium">No Bluesky credentials set.</span>
              <span className="text-gray-400"> For your home timeline, <a href="/settings" className="underline text-gray-600 hover:text-gray-900">add your handle and app password in Settings → Pulse</a>. Public profile feeds work without credentials.</span>
            </p>
          )
        ) : (
          <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">{TYPE_HINT[form.type]}</p>
        )}
      </div>
      <button
        type="submit"
        disabled={adding}
        className="bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-800 dark:hover:bg-zinc-200 disabled:opacity-50 flex items-center gap-2"
      >
        {adding && <Loader2 size={13} className="animate-spin" />}
        {adding ? 'Fetching…' : 'Add feed'}
      </button>
    </form>
  )
}
