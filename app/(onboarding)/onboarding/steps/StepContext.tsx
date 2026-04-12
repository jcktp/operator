'use client'

import { useState } from 'react'
import type { ModeConfig } from '@/lib/mode'

interface Props {
 modeConfig: ModeConfig
 onNext: () => void
 onBack: () => void
}

async function saveSetting(key: string, value: string) {
 await fetch('/api/settings', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ key, value }),
 })
}

const ORG_PLACEHOLDER: Record<string, string> = {
 journalism: 'e.g. The Guardian, NRC, Freelance',
 market_research: 'e.g. Acme Research, Client: Nike',
 legal: 'e.g. Chambers & Partners, In-house at Acme',
 team_lead: 'e.g. Acme Engineering',
 human_resources: 'e.g. Acme Corp HR',
}

const MEMORY_PLACEHOLDER: Record<string, string> = {
 journalism: 'e.g. I cover climate policy and Eastern Europe. I prefer bullet-point summaries. Always cite sources.',
 executive: 'e.g. Our FY runs April–March. Revenue target is €50M. Focus on EMEA and APAC.',
 market_research: 'e.g. I focus on B2B SaaS. I prefer verbatim quotes highlighted separately from synthesis.',
 legal: 'e.g. I specialise in employment law. Flag any statute references.',
 team_lead: 'e.g. We run two-week sprints. Velocity target is 40 points. Surface blockers first.',
 human_resources: 'e.g. We use OKRs. Focus on attrition and engagement scores.',
}

export default function StepContext({ modeConfig, onNext, onBack }: Props) {
 const [orgName, setOrgName] = useState('')
 const [memory, setMemory] = useState('')
 const [saving, setSaving] = useState(false)

 const handleContinue = async () => {
 setSaving(true)
 try {
 const saves: Promise<void>[] = []
 if (orgName.trim()) saves.push(saveSetting('company_name', orgName.trim()))
 if (memory.trim()) saves.push(saveSetting('user_memory', memory.trim()))
 await Promise.all(saves)
 } finally {
 setSaving(false)
 onNext()
 }
 }

 const orgLabel = modeConfig.id === 'journalism' || modeConfig.id === 'market_research'
 ? 'Project or organisation name'
 : 'Organisation name'

 const orgPlaceholder = ORG_PLACEHOLDER[modeConfig.id] ?? 'e.g. Acme Corp'
 const memPlaceholder = MEMORY_PLACEHOLDER[modeConfig.id] ?? 'e.g. I prefer concise summaries with key findings up front.'

 return (
 <div className="space-y-6">
 <div>
 <h2 className="text-xl font-semibold text-[var(--text-bright)] mb-1">Prime the AI</h2>
 <p className="text-sm text-[var(--text-muted)]">
 Stored locally on your machine. Helps the AI give better answers from day one. All fields are optional — you can fill these in later from Settings.
 </p>
 </div>

 <div className="space-y-4">
 <div>
 <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1.5">
 {orgLabel}
 </label>
 <input
 type="text"
 value={orgName}
 onChange={e => setOrgName(e.target.value)}
 placeholder={orgPlaceholder}
 className="w-full px-3 py-2.5 text-sm text-[var(--text-bright)] bg-[var(--surface)] border border-[var(--border)] rounded-[4px] focus:outline-none focus:ring-1 placeholder-gray-400 transition-colors"
 />
 </div>

 <div>
 <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1.5">
 Anything the AI should know about you or your work
 </label>
 <textarea
 value={memory}
 onChange={e => setMemory(e.target.value)}
 rows={4}
 placeholder={memPlaceholder}
 className="w-full px-3 py-2.5 text-sm text-[var(--text-bright)] bg-[var(--surface)] border border-[var(--border)] rounded-[4px] focus:outline-none focus:ring-1 resize-none placeholder-gray-400 transition-colors"
 />
 <p className="text-xs text-[var(--text-muted)] mt-1.5">
 This feeds directly into Dispatch and every AI analysis from the moment you start.
 </p>
 </div>
 </div>

 <div className="flex gap-3">
 <button onClick={onBack} className="flex-1 py-3 bg-[var(--surface-2)] text-[var(--text-body)] text-sm font-medium rounded-[10px] hover:bg-[var(--surface-3)] transition-colors">
 ← Back
 </button>
 <button
 onClick={handleContinue}
 disabled={saving}
 className="flex-[3] py-3 bg-[var(--ink)] text-white text-sm font-medium rounded-[10px] hover:opacity-90 transition-colors disabled:opacity-60"
 >
 {saving ? 'Saving…' : 'Continue →'}
 </button>
 </div>
 </div>
 )
}
