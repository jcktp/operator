'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, AlertTriangle, Eye, EyeOff, ShieldAlert, ArrowRight } from 'lucide-react'
import WalkieTalkie from '@/components/WalkieTalkie'
import { MODE_LIST, type AppMode } from '@/lib/mode'

type Screen = 'loading' | 'mode-pick' | 'setup' | 'login' | 'recover' | 'reset' | 'uninstalled'

export default function LoginPage() {
 const router = useRouter()
 const [screen, setScreen] = useState<Screen>('loading')
 const [selectedMode, setSelectedMode] = useState<AppMode>('executive')
 const [name, setName] = useState('')
 const [role, setRole] = useState('')
 const [password, setPassword] = useState('')
 const [confirm, setConfirm] = useState('')
 const [showPass, setShowPass] = useState(false)
 const [submitting, setSubmitting] = useState(false)
 const [error, setError] = useState('')
 const [attemptsLeft, setAttemptsLeft] = useState(3)
 const [recoveryCode, setRecoveryCode] = useState('')
 const [resetToken, setResetToken] = useState('')
 const [newPassword, setNewPassword] = useState('')
 const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
 const passwordRef = useRef<HTMLInputElement>(null)

 useEffect(() => {
 fetch('/api/auth/status')
 .then(r => r.json())
 .then((d: { setupComplete: boolean; attemptsLeft: number }) => {
 setAttemptsLeft(d.attemptsLeft)
 setScreen(d.setupComplete ? 'login' : 'mode-pick')
 setTimeout(() => passwordRef.current?.focus(), 100)
 })
 .catch(() => setScreen('mode-pick'))
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
 headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
 body: JSON.stringify({ name, role, password, appMode: selectedMode }),
 })
 const data = await res.json() as { ok?: boolean; error?: string }
 if (res.ok) {
 router.replace('/')
 router.refresh()
 } else {
 setError(data.error ?? 'Setup failed')
 }
 } catch {
 setError('Could not connect to server. Please try again.')
 } finally {
 setSubmitting(false)
 }
 }

 const handleRecover = async (e: React.FormEvent) => {
 e.preventDefault()
 setSubmitting(true)
 setError('')
 try {
 const res = await fetch('/api/auth/recover', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ code: recoveryCode.trim() }),
 })
 const data = await res.json() as { resetToken?: string; error?: string }
 if (res.ok && data.resetToken) {
 setResetToken(data.resetToken)
 setScreen('reset')
 } else {
 setError(data.error ?? 'Invalid recovery code')
 }
 } catch {
 setError('Could not connect to server.')
 } finally {
 setSubmitting(false)
 }
 }

 const handleResetPassword = async (e: React.FormEvent) => {
 e.preventDefault()
 if (newPassword !== newPasswordConfirm) { setError('Passwords do not match'); return }
 if (newPassword.length < 6) { setError('Password must be at least 6 characters'); return }
 setSubmitting(true)
 setError('')
 try {
 const res = await fetch('/api/auth/reset-password', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ token: resetToken, newPassword }),
 })
 const data = await res.json() as { ok?: boolean; error?: string }
 if (res.ok) {
 router.replace('/')
 router.refresh()
 } else {
 setError(data.error ?? 'Reset failed')
 }
 } catch {
 setError('Could not connect to server.')
 } finally {
 setSubmitting(false)
 }
 }

 const handleLogin = async (e: React.FormEvent) => {
 e.preventDefault()
 // fix #9: require explicit confirmation before the final attempt
 if (attemptsLeft === 1) {
 const confirmed = window.confirm(
 'Warning: This is your final login attempt.\n\nAn incorrect password will permanently delete Operator and all your data with no recovery option.\n\nContinue?'
 )
 if (!confirmed) return
 }
 setSubmitting(true)
 setError('')
 try {
 const res = await fetch('/api/auth/login', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
 body: JSON.stringify({ password }),
 })
 const data = await res.json() as { ok?: boolean; error?: string; attemptsLeft?: number; uninstalled?: boolean }
 if (res.ok) {
 router.replace('/')
 router.refresh()
 } else if (data.uninstalled) {
 setScreen('uninstalled')
 } else {
 setError(data.error ?? 'Incorrect password')
 if (data.attemptsLeft !== undefined) setAttemptsLeft(data.attemptsLeft)
 setPassword('')
 passwordRef.current?.focus()
 }
 } catch {
 setError('Could not connect to server. Please try again.')
 } finally {
 setSubmitting(false)
 }
 }

 // ── Loading ──────────────────────────────────────────────────────────────────
 if (screen === 'loading') {
 return (
 <div className="fixed inset-0 z-[200] bg-[#fafafa] flex items-center justify-center">
 <Loader2 size={20} className="animate-spin text-[var(--border)] " />
 </div>
 )
 }

 // ── Uninstalled ──────────────────────────────────────────────────────────────
 if (screen === 'uninstalled') {
 return (
 <div className="fixed inset-0 z-[200] bg-gray-950 flex flex-col items-center justify-center">
 <div className="text-center space-y-4 max-w-sm px-8">
 <div className="w-10 h-10 mx-auto rounded-full bg-[var(--ink)] flex items-center justify-center">
 <ShieldAlert size={18} className="text-[var(--red)]" />
 </div>
 <p className="text-[var(--border)] text-sm font-medium">Operator has been deleted</p>
 <p className="text-[var(--text-muted)] text-xs leading-relaxed">
 Maximum login attempts exceeded. All data and the application have been permanently removed. You can close this tab.
 </p>
 </div>
 </div>
 )
 }

 // ── Shared card wrapper ──────────────────────────────────────────────────────
 return (
 <div className="fixed inset-0 z-[200] bg-[#fafafa] flex items-center justify-center px-4 overflow-y-auto py-8">
 <div className="w-full max-w-sm my-auto">

 {/* Logo */}
 <div className="flex flex-col items-center mb-8 gap-2">
 <WalkieTalkie />
 <span className="text-2xl text-[var(--text-bright)] "style={{ fontFamily: 'var(--font-caveat)', fontWeight: 700 }}>
 operator
 </span>
 </div>

 {/* ── Step 1: Mode picker ── */}
 {screen === 'mode-pick' && (
 <div className="space-y-5">
 <div>
 <h1 className="text-lg font-semibold text-[var(--text-bright)]">How will you use Operator?</h1>
 <p className="text-sm text-[var(--text-muted)] mt-0.5">This tailors the app to your workflow.</p>
 </div>

 <div className="grid grid-cols-2 gap-2">
 {MODE_LIST.map(m => (
 <button
 key={m.id}
 type="button"
 onClick={() => setSelectedMode(m.id)}
 className={`text-left p-3 rounded-[10px] border-2 transition-all ${
 selectedMode === m.id
 ? 'border-[var(--ink)] bg-[var(--ink)] text-white'
 : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-bright)] hover:border-[var(--border)] '
 }`}
 >
 <div className="text-xl mb-1.5">{m.icon}</div>
 <div className="text-xs font-semibold">{m.label}</div>
 <div className={`text-[10px] mt-0.5 leading-tight ${selectedMode === m.id ? 'text-[var(--border)]' : 'text-[var(--text-muted)]'}`}>
 {m.tagline}
 </div>
 </button>
 ))}
 </div>

 <button
 type="button"
 onClick={() => setScreen('setup')}
 className="w-full bg-[var(--ink)] text-white text-sm font-medium h-7 px-3 rounded-[4px] hover:bg-[var(--ink)] transition-colors flex items-center justify-center gap-2"
 >
 Continue <ArrowRight size={14} />
 </button>
 </div>
 )}

 {/* ── Step 2: Setup form ── */}
 {screen === 'setup' && (
 <form onSubmit={handleSetup} className="space-y-5">
 <div>
 <h1 className="text-lg font-semibold text-[var(--text-bright)]">Set up Operator</h1>
 <p className="text-sm text-[var(--text-muted)] mt-0.5">Create your account to get started.</p>
 </div>

 {/* Warning */}
 <div className="bg-red-50 border border-red-200 rounded-[10px] p-4 flex gap-3">
 <AlertTriangle size={16} className="text-[var(--red)] shrink-0 mt-0.5" />
 <div className="text-xs text-red-700 leading-relaxed space-y-1">
 <p className="font-semibold">Do not forget your password</p>
 <p>
 After <strong>3 incorrect login attempts</strong>, Operator will automatically and
 permanently delete itself and all your data. There is no recovery and no reset option.
 </p>
 </div>
 </div>

 <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4 space-y-4">
 <div>
 <label className="block text-xs font-medium text-[var(--text-body)] mb-1.5">Your name <span className="text-[var(--red)]">*</span></label>
 <input
 type="text"value={name} onChange={e => setName(e.target.value)} required
 placeholder="Alex Chen"
 className="w-full border border-[var(--border)] rounded-[4px] px-3 py-2 text-sm text-[var(--text-bright)] bg-[var(--surface)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2"
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-[var(--text-body)] mb-1.5">Your role <span className="text-[var(--text-muted)] font-normal">(optional)</span></label>
 <input
 type="text"value={role} onChange={e => setRole(e.target.value)}
 placeholder="e.g. CEO, Journalist, Team Lead"
 className="w-full border border-[var(--border)] rounded-[4px] px-3 py-2 text-sm text-[var(--text-bright)] bg-[var(--surface)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2"
 />
 <p className="text-[11px] text-[var(--text-muted)] mt-1">The AI will tailor responses to your role.</p>
 </div>
 <div>
 <label className="block text-xs font-medium text-[var(--text-body)] mb-1.5">Password <span className="text-[var(--red)]">*</span></label>
 <div className="relative">
 <input
 ref={passwordRef}
 type={showPass ? 'text' : 'password'}
 value={password} onChange={e => setPassword(e.target.value)} required
 placeholder="Min. 6 characters"
 className="w-full border border-[var(--border)] rounded-[4px] px-3 py-2 pr-9 text-sm text-[var(--text-bright)] bg-[var(--surface)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2"
 />
 <button type="button"onClick={() => setShowPass(v => !v)}
 className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-subtle)]">
 {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
 </button>
 </div>
 </div>
 <div>
 <label className="block text-xs font-medium text-[var(--text-body)] mb-1.5">Confirm password <span className="text-[var(--red)]">*</span></label>
 <input
 type={showPass ? 'text' : 'password'}
 value={confirm} onChange={e => setConfirm(e.target.value)} required
 placeholder="Repeat password"
 className="w-full border border-[var(--border)] rounded-[4px] px-3 py-2 text-sm text-[var(--text-bright)] bg-[var(--surface)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2"
 />
 </div>
 </div>

 {error && <p className="text-sm text-[var(--red)] text-center">{error}</p>}

 <div className="flex gap-2">
 <button type="button"onClick={() => setScreen('mode-pick')}
 className="h-7 px-3 rounded-[4px] border border-[var(--border)] text-xs font-medium text-[var(--text-subtle)] hover:bg-[var(--surface-2)] transition-colors">
 Back
 </button>
 <button type="submit"disabled={submitting || !name.trim() || !password || !confirm}
 className="flex-1 bg-[var(--ink)] text-white text-sm font-medium h-7 px-3 rounded-[4px] hover:bg-[var(--ink)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
 {submitting ? <><Loader2 size={14} className="animate-spin" /> Setting up…</> : 'Create account'}
 </button>
 </div>
 </form>
 )}

 {/* ── Login form ── */}
 {screen === 'login' && (
 <form onSubmit={handleLogin} className="space-y-5">
 <div>
 <h1 className="text-lg font-semibold text-[var(--text-bright)]">Welcome back</h1>
 <p className="text-sm text-[var(--text-muted)] mt-0.5">Enter your password to continue.</p>
 </div>

 {attemptsLeft < 3 && (
 <div className="bg-amber-50 border border-amber-200 rounded-[10px] p-3 flex gap-2">
 <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
 <p className="text-xs text-amber-700">
 <strong>{attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} remaining.</strong>{' '}
 {attemptsLeft === 1
 ? 'One more failure will permanently delete Operator and all data.'
 : 'After 3 total failures, Operator will permanently delete itself.'}
 </p>
 </div>
 )}

 <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4">
 <label className="block text-xs font-medium text-[var(--text-body)] mb-1.5">Password</label>
 <div className="relative">
 <input
 ref={passwordRef}
 type={showPass ? 'text' : 'password'}
 value={password} onChange={e => setPassword(e.target.value)} required autoFocus
 placeholder="Enter your password"
 className="w-full border border-[var(--border)] rounded-[4px] px-3 py-2 pr-9 text-sm text-[var(--text-bright)] bg-[var(--surface)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2"
 />
 <button type="button"onClick={() => setShowPass(v => !v)}
 className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-subtle)]">
 {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
 </button>
 </div>
 </div>

 {error && <p className="text-sm text-[var(--red)] text-center">{error}</p>}

 <button type="submit"disabled={submitting || !password}
 className="w-full bg-[var(--ink)] text-white text-sm font-medium h-7 px-3 rounded-[4px] hover:bg-[var(--ink)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
 {submitting ? <><Loader2 size={14} className="animate-spin" /> Signing in…</> : 'Sign in'}
 </button>

 <button type="button"onClick={() => { setError(''); setScreen('recover') }}
 className="w-full text-xs text-[var(--text-muted)] hover:text-[var(--text-subtle)] transition-colors py-1">
 Forgot password? Use a recovery code
 </button>
 </form>
 )}

 {/* ── Recovery code screen ── */}
 {screen === 'recover' && (
 <form onSubmit={handleRecover} className="space-y-5">
 <div>
 <h1 className="text-lg font-semibold text-[var(--text-bright)]">Recovery code</h1>
 <p className="text-sm text-[var(--text-muted)] mt-0.5">Enter one of your saved recovery codes to reset your password.</p>
 </div>

 <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4">
 <label className="block text-xs font-medium text-[var(--text-body)] mb-1.5">Recovery code</label>
 <input
 type="text"
 value={recoveryCode}
 onChange={e => setRecoveryCode(e.target.value)}
 placeholder="XXXXX-XXXXX"
 autoFocus
 className="w-full border border-[var(--border)] rounded-[4px] px-3 py-2 text-sm font-mono text-[var(--text-bright)] bg-[var(--surface)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2"
 />
 </div>

 {error && <p className="text-sm text-[var(--red)] text-center">{error}</p>}

 <div className="flex gap-2">
 <button type="button"onClick={() => { setError(''); setScreen('login') }}
 className="h-7 px-3 rounded-[4px] border border-[var(--border)] text-xs font-medium text-[var(--text-subtle)] hover:bg-[var(--surface-2)] transition-colors">
 Back
 </button>
 <button type="submit"disabled={submitting || !recoveryCode.trim()}
 className="flex-1 bg-[var(--ink)] text-white text-sm font-medium h-7 px-3 rounded-[4px] hover:bg-[var(--ink)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
 {submitting ? <><Loader2 size={14} className="animate-spin" /> Checking…</> : 'Verify code'}
 </button>
 </div>
 </form>
 )}

 {/* ── New password screen ── */}
 {screen === 'reset' && (
 <form onSubmit={handleResetPassword} className="space-y-5">
 <div>
 <h1 className="text-lg font-semibold text-[var(--text-bright)]">Set new password</h1>
 <p className="text-sm text-[var(--text-muted)] mt-0.5">Choose a new password. You&apos;ll be signed in automatically.</p>
 </div>

 <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4 space-y-4">
 <div>
 <label className="block text-xs font-medium text-[var(--text-body)] mb-1.5">New password</label>
 <div className="relative">
 <input
 type={showPass ? 'text' : 'password'}
 value={newPassword}
 onChange={e => setNewPassword(e.target.value)}
 placeholder="Min. 6 characters"
 autoFocus
 className="w-full border border-[var(--border)] rounded-[4px] px-3 py-2 pr-9 text-sm text-[var(--text-bright)] bg-[var(--surface)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2"
 />
 <button type="button"onClick={() => setShowPass(v => !v)}
 className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-subtle)]">
 {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
 </button>
 </div>
 </div>
 <div>
 <label className="block text-xs font-medium text-[var(--text-body)] mb-1.5">Confirm password</label>
 <input
 type={showPass ? 'text' : 'password'}
 value={newPasswordConfirm}
 onChange={e => setNewPasswordConfirm(e.target.value)}
 placeholder="Repeat password"
 className="w-full border border-[var(--border)] rounded-[4px] px-3 py-2 text-sm text-[var(--text-bright)] bg-[var(--surface)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2"
 />
 </div>
 </div>

 {error && <p className="text-sm text-[var(--red)] text-center">{error}</p>}

 <button type="submit"disabled={submitting || !newPassword || !newPasswordConfirm}
 className="w-full bg-[var(--ink)] text-white text-sm font-medium h-7 px-3 rounded-[4px] hover:bg-[var(--ink)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
 {submitting ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : 'Set password & sign in'}
 </button>
 </form>
 )}

 </div>
 </div>
 )
}
