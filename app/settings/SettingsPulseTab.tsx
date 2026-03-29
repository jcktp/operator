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
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">Social accounts</h2>
        <p className="text-xs text-gray-400 mt-0.5">Sign in to see your home timeline in Pulse. Not required for public profile feeds.</p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-700">Bluesky</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Handle</label>
            <input
              type="text"
              value={bskyIdentifier}
              onChange={e => setBskyIdentifier(e.target.value)}
              placeholder="you.bsky.social  (not .bsky.app)"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">App password</label>
            <input
              type="password"
              value={bskyAppPassword === '__saved__' ? '' : bskyAppPassword}
              onChange={e => setBskyAppPassword(e.target.value)}
              placeholder={bskyAppPassword === '__saved__' ? 'App password saved — enter new to replace' : 'xxxx-xxxx-xxxx-xxxx'}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 font-mono"
            />
          </div>
        </div>
        <p className="text-[11px] text-gray-400">Generate an app password at bsky.app → Settings → App Passwords. Your home timeline will appear in Pulse automatically when you save.</p>
      </div>

      <div className="space-y-2 pt-3 border-t border-gray-100">
        <p className="text-xs font-semibold text-gray-700">Mastodon</p>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Access token</label>
          <input
            type="password"
            value={mastodonToken}
            onChange={e => setMastodonToken(e.target.value)}
            placeholder="Paste token here"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 font-mono"
          />
        </div>
        <p className="text-[11px] text-gray-400">Generate at your instance → Preferences → Development → New application (read:statuses scope). Then add a Mastodon feed in Pulse with URL set to your instance domain, e.g. <code className="font-mono">mastodon.social</code>.</p>
      </div>

      <button type="button" onClick={onSave} disabled={saving}
        className="w-full bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
        {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : 'Save'}
      </button>
    </div>
  )
}
