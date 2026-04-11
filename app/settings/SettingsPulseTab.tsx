'use client'

import { Loader2 } from 'lucide-react'

interface Props {
 bskyIdentifier: string
 setBskyIdentifier: (v: string) => void
 bskyAppPassword: string
 setBskyAppPassword: (v: string) => void
 mastodonToken: string
 setMastodonToken: (v: string) => void
 saving: boolean
 onSave: () => void
}

export default function SettingsPulseTab({
 bskyIdentifier, setBskyIdentifier,
 bskyAppPassword, setBskyAppPassword,
 mastodonToken, setMastodonToken,
 saving, onSave,
}: Props) {
 return (
 <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-5 space-y-4">
 <div>
 <h2 className="text-sm font-semibold text-[var(--text-bright)]">Social accounts</h2>
 <p className="text-xs text-[var(--text-muted)] mt-0.5">Sign in to see your home timeline in Pulse. Not required for public profile feeds.</p>
 </div>

 <div className="space-y-2">
 <p className="text-xs font-semibold text-[var(--text-body)]">Bluesky</p>
 <div className="grid grid-cols-2 gap-2">
 <div>
 <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Handle</label>
 <input
 type="text"
 value={bskyIdentifier}
 onChange={e => setBskyIdentifier(e.target.value)}
 placeholder="you.bsky.social (not .bsky.app)"
 className="w-full h-8 border border-[var(--border)] rounded-[4px] px-2.5 text-xs focus:outline-none focus:ring-2"
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">App password</label>
 <input
 type="password"
 value={bskyAppPassword === '__saved__' ? '' : bskyAppPassword}
 onChange={e => setBskyAppPassword(e.target.value)}
 placeholder={bskyAppPassword === '__saved__' ? 'App password saved — enter new to replace' : 'xxxx-xxxx-xxxx-xxxx'}
 className="w-full h-8 border border-[var(--border)] rounded-[4px] px-2.5 text-xs focus:outline-none focus:ring-2 font-mono"
 />
 </div>
 </div>
 <p className="text-[11px] text-[var(--text-muted)]">Generate an app password at bsky.app → Settings → App Passwords. Your home timeline will appear in Pulse automatically when you save.</p>
 </div>

 <div className="space-y-2 pt-3 border-t border-[var(--border)]">
 <p className="text-xs font-semibold text-[var(--text-body)]">Mastodon</p>
 <div>
 <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Access token</label>
 <input
 type="password"
 value={mastodonToken}
 onChange={e => setMastodonToken(e.target.value)}
 placeholder="Paste token here"
 className="w-full h-8 border border-[var(--border)] rounded-[4px] px-2.5 text-xs focus:outline-none focus:ring-2 font-mono"
 />
 </div>
 <p className="text-[11px] text-[var(--text-muted)]">Generate at your instance → Preferences → Development → New application (read:statuses scope). Then add a Mastodon feed in Pulse with URL set to your instance domain, e.g. <code className="font-mono">mastodon.social</code>.</p>
 </div>

 <button type="button" onClick={onSave} disabled={saving}
 className="w-full bg-[var(--ink)] text-white text-sm font-medium h-7 px-3 rounded-[4px] :bg-[var(--ink)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
 {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : 'Save'}
 </button>
 </div>
 )
}
