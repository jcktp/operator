'use client'

import Link from 'next/link'
import { GraduationCap } from 'lucide-react'
import YouPanel from './YouPanel'

export default function SettingsKnowledgeTab() {
  return (
    <div className="space-y-5">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-5">
        <h2 className="text-sm font-semibold text-[var(--text-bright)] mb-4">Your context</h2>
        <YouPanel />
      </div>

      <Link
        href="/knowledge"
        className="flex items-center justify-between gap-3 bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4 hover:bg-[var(--surface-2)]/50 transition-colors"
      >
        <div className="flex items-start gap-3">
          <GraduationCap size={18} className="text-[var(--text-muted)] mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-[var(--text-bright)]">Glossary &amp; area briefings</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Manage glossary terms and per-beat briefings on the Knowledge page.
            </p>
          </div>
        </div>
        <span className="text-xs font-medium text-[var(--text-subtle)] shrink-0">Open →</span>
      </Link>
    </div>
  )
}
