/**
 * Layout D — Full-width centered scroll
 * ────────────────────────────────────────────────────────────────────────
 * Per layout-reference.html: content max-w-900 centered; outer scroll.
 *
 * Used by: Dashboard, Pulse, Projects, FOIA, Risks, Claims, Tracker, etc.
 */
import type React from 'react'

interface Props {
  /** Optional page title row above the body. Sticky. */
  header?: React.ReactNode
  /** Body content. */
  children: React.ReactNode
  /** Override max-width; defaults to 900. */
  maxWidth?: number
}

export default function LayoutD({ header, children, maxWidth = 900 }: Props) {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      {header && (
        <div className="shrink-0 border-b border-[var(--border)]">
          {header}
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-7 py-6 mx-auto" style={{ maxWidth }}>
          {children}
        </div>
      </div>
    </div>
  )
}
