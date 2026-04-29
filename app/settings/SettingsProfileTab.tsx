'use client'

import { X, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getModeConfig } from '@/lib/mode'
import SelectField from '@/components/SelectField'
import RecoveryCodesPanel from './RecoveryCodesPanel'
import type { useSettingsState } from './useSettingsState'

interface Props {
  s: ReturnType<typeof useSettingsState>
  theme: string
  mode: 'light' | 'dark' | 'system'
  setMode: (m: 'light' | 'dark' | 'system') => void
}

export default function SettingsProfileTab({ s, theme, mode, setMode }: Props) {
  return (
    <>
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-5 space-y-3">
        <h2 className="text-sm font-semibold text-[var(--text-bright)]">Profile</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1.5">Your name</label>
            <input type="text" value={s.ceoName} onChange={e => s.setCeoName(e.target.value)} placeholder="Alex Chen"
              className="w-full border border-[var(--border)] rounded-[4px] px-3 py-2 text-sm focus:outline-none focus:ring-2" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1.5">Company</label>
            <input type="text" value={s.companyName} onChange={e => s.setCompanyName(e.target.value)} placeholder="Acme Corp"
              className="w-full border border-[var(--border)] rounded-[4px] px-3 py-2 text-sm focus:outline-none focus:ring-2" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1.5">Your role</label>
          <input type="text" value={s.userRole} onChange={e => s.setUserRole(e.target.value)} placeholder="e.g. CEO, Head of Product, COO"
            className="w-full border border-[var(--border)] rounded-[4px] px-3 py-2 text-sm focus:outline-none focus:ring-2" />
        </div>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--text-bright)]">Sound effects</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Walkie-talkie chirp on startup and shutdown</p>
          </div>
          <button
            type="button"
            onClick={() => s.setSoundEnabled(v => !v)}
            className={cn(
              'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
              s.soundEnabled ? 'bg-[var(--ink)]' : 'bg-[var(--surface-3)]'
            )}
          >
            <span className={cn(
              'pointer-events-none inline-block h-4 w-4 rounded-full bg-[var(--surface)] shadow transform transition-transform',
              s.soundEnabled ? 'translate-x-4' : 'translate-x-0'
            )} />
          </button>
        </div>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[var(--text-bright)]">Appearance</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {mode === 'system' ? `Auto — following system (${theme})` : mode === 'dark' ? 'Dark theme' : 'Light theme'}
            </p>
          </div>
          <div className="flex rounded-[4px] border border-[var(--border)] overflow-hidden shrink-0">
            {(['light', 'dark', 'system'] as const).map((m, i) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium transition-colors',
                  i > 0 && 'border-l border-[var(--border)]',
                  mode === m
                    ? 'bg-[var(--ink)] text-[var(--ink-contrast)]'
                    : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)]'
                )}
              >
                {m === 'system' ? 'Auto' : m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--text-bright)]">Beats</h2>
          {s.areasCustomized && (
            <button type="button"
              onClick={() => { s.setCustomAreas(getModeConfig('journalism').defaultAreas); s.setAreasCustomized(false) }}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-subtle)] transition-colors">
              Reset to defaults
            </button>
          )}
        </div>
        <p className="text-xs text-[var(--text-muted)]">Beats appear when uploading documents and creating request links.</p>
        <div className="flex flex-wrap gap-2">
          {s.customAreas.map(area => (
            <span key={area} className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-[var(--surface-2)] text-xs text-[var(--text-body)] rounded-md">
              {area}
              <button type="button" onClick={() => { s.setCustomAreas(a => a.filter(x => x !== area)); s.setAreasCustomized(true) }}
                className="text-[var(--text-muted)] hover:text-[var(--text-body)] transition-colors">
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={s.newArea}
            onChange={e => s.setNewArea(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                const v = s.newArea.trim()
                if (v && !s.customAreas.includes(v)) { s.setCustomAreas(a => [...a, v]); s.setNewArea(''); s.setAreasCustomized(true) }
              }
            }}
            placeholder="Add area…"
            className="flex-1 border border-[var(--border)] rounded-[4px] px-3 py-2 text-sm focus:outline-none focus:ring-2"
          />
          <button
            type="button"
            onClick={() => {
              const v = s.newArea.trim()
              if (v && !s.customAreas.includes(v)) { s.setCustomAreas(a => [...a, v]); s.setNewArea(''); s.setAreasCustomized(true) }
            }}
            className="px-3 py-2 bg-[var(--ink)] text-[var(--ink-contrast)] text-sm font-medium rounded-[4px] hover:bg-[var(--ink)] transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-5 space-y-4">
        <h2 className="text-sm font-semibold text-[var(--text-bright)]">Security</h2>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-[var(--text-body)]">Auto-lock</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Lock after inactivity and require password</p>
          </div>
          <SelectField
            value={String(s.autoLockMinutes)}
            onChange={v => s.setAutoLockMinutes(parseInt(v))}
            className="w-32"
            options={[
              { value: '0', label: 'Never' },
              { value: '5', label: '5 min' },
              { value: '10', label: '10 min' },
              { value: '15', label: '15 min' },
              { value: '30', label: '30 min' },
              { value: '60', label: '1 hour' },
            ]}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-[var(--text-body)]">Air-gap mode</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Block all outbound network calls (cloud AI, web search, feeds)</p>
          </div>
          <button
            type="button"
            onClick={() => s.setAirGapMode(v => !v)}
            className={cn(
              'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
              s.airGapMode ? 'bg-red-500' : 'bg-[var(--surface-3)]'
            )}
          >
            <span className={cn(
              'pointer-events-none inline-block h-4 w-4 rounded-full bg-[var(--surface)] shadow transform transition-transform',
              s.airGapMode ? 'translate-x-4' : 'translate-x-0'
            )} />
          </button>
        </div>
        {s.airGapMode && (
          <p className="text-xs text-[var(--red)] bg-[var(--red-dim)] border border-[var(--red)] rounded-[4px] px-3 py-2">
            Air-gap active — only Ollama (local) analysis works. Cloud providers and Pulse feeds are disabled.
          </p>
        )}
      </div>

      <RecoveryCodesPanel />
    </>
  )
}
