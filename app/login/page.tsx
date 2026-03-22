'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, AlertTriangle, Eye, EyeOff, ShieldAlert } from 'lucide-react'
import WalkieTalkie from '@/components/WalkieTalkie'

type Mode = 'loading' | 'setup' | 'login' | 'uninstalled'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('loading')
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [attemptsLeft, setAttemptsLeft] = useState(3)
  const passwordRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/auth/status')
      .then(r => r.json())
      .then((d: { setupComplete: boolean; attemptsLeft: number }) => {
        setAttemptsLeft(d.attemptsLeft)
        setMode(d.setupComplete ? 'login' : 'setup')
        setTimeout(() => passwordRef.current?.focus(), 100)
      })
      .catch(() => setMode('setup'))
  }, [])

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, role, password }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (res.ok) {
        router.replace('/')
        router.refresh()
      } else {
        setError(data.error ?? 'Setup failed')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json() as { ok?: boolean; error?: string; attemptsLeft?: number; uninstalled?: boolean }
      if (res.ok) {
        router.replace('/')
        router.refresh()
      } else if (data.uninstalled) {
        setMode('uninstalled')
      } else {
        setError(data.error ?? 'Incorrect password')
        if (data.attemptsLeft !== undefined) setAttemptsLeft(data.attemptsLeft)
        setPassword('')
        passwordRef.current?.focus()
      }
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (mode === 'loading') {
    return (
      <div className="fixed inset-0 z-[200] bg-[#fafafa] flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-gray-300" />
      </div>
    )
  }

  // ── Uninstalled ────────────────────────────────────────────────────────────
  if (mode === 'uninstalled') {
    return (
      <div className="fixed inset-0 z-[200] bg-gray-950 flex flex-col items-center justify-center">
        <div className="text-center space-y-4 max-w-sm px-8">
          <div className="w-10 h-10 mx-auto rounded-full bg-gray-800 flex items-center justify-center">
            <ShieldAlert size={18} className="text-red-400" />
          </div>
          <p className="text-gray-200 text-sm font-medium">Operator has been deleted</p>
          <p className="text-gray-500 text-xs leading-relaxed">
            Maximum login attempts exceeded. All data and the application have been permanently removed. You can close this tab.
          </p>
        </div>
      </div>
    )
  }

  // ── Shared card wrapper ────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[200] bg-[#fafafa] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8 gap-2">
          <WalkieTalkie />
          <span className="text-2xl text-gray-900" style={{ fontFamily: 'var(--font-caveat)', fontWeight: 700 }}>
            operator
          </span>
        </div>

        {/* ── Setup form ── */}
        {mode === 'setup' && (
          <form onSubmit={handleSetup} className="space-y-5">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Set up Operator</h1>
              <p className="text-sm text-gray-500 mt-0.5">Create your account to get started.</p>
            </div>

            {/* Warning */}
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
              <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
              <div className="text-xs text-red-700 leading-relaxed space-y-1">
                <p className="font-semibold">Do not forget your password</p>
                <p>
                  After <strong>3 incorrect login attempts</strong>, Operator will automatically and
                  permanently delete itself and all your data. There is no recovery and no reset option.
                </p>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Your name <span className="text-red-400">*</span></label>
                <input
                  type="text" value={name} onChange={e => setName(e.target.value)} required
                  placeholder="Alex Chen"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Your role <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  type="text" value={role} onChange={e => setRole(e.target.value)}
                  placeholder="e.g. CEO, Head of Product, COO"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                <p className="text-[11px] text-gray-400 mt-1">The AI will tailor responses to your role.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Password <span className="text-red-400">*</span></label>
                <div className="relative">
                  <input
                    ref={passwordRef}
                    type={showPass ? 'text' : 'password'}
                    value={password} onChange={e => setPassword(e.target.value)} required
                    placeholder="Min. 6 characters"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Confirm password <span className="text-red-400">*</span></label>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={confirm} onChange={e => setConfirm(e.target.value)} required
                  placeholder="Repeat password"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
            </div>

            {error && <p className="text-sm text-red-500 text-center">{error}</p>}

            <button type="submit" disabled={submitting || !name.trim() || !password || !confirm}
              className="w-full bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {submitting ? <><Loader2 size={14} className="animate-spin" /> Setting up…</> : 'Create account'}
            </button>
          </form>
        )}

        {/* ── Login form ── */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Welcome back</h1>
              <p className="text-sm text-gray-500 mt-0.5">Enter your password to continue.</p>
            </div>

            {attemptsLeft < 3 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
                <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  <strong>{attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} remaining.</strong>{' '}
                  {attemptsLeft === 1
                    ? 'One more failure will permanently delete Operator and all data.'
                    : 'After 3 total failures, Operator will permanently delete itself.'}
                </p>
              </div>
            )}

            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  ref={passwordRef}
                  type={showPass ? 'text' : 'password'}
                  value={password} onChange={e => setPassword(e.target.value)} required autoFocus
                  placeholder="Enter your password"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-red-500 text-center">{error}</p>}

            <button type="submit" disabled={submitting || !password}
              className="w-full bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {submitting ? <><Loader2 size={14} className="animate-spin" /> Signing in…</> : 'Sign in'}
            </button>
          </form>
        )}

      </div>
    </div>
  )
}
