/**
 * Layout C — Content + right aside
 * ────────────────────────────────────────────────────────────────────────
 * Per layout-reference.html: content(flex-1) | aside(220).
 * Content scrolls; aside is fixed (independent scroll).
 *
 * Used by: Reports/[id], Upload.
 */
import type React from 'react'

interface Props {
  /** Optional page title row above the body. Sticky. */
  header?: React.ReactNode
  /** Center content pane. */
  children: React.ReactNode
  /** Right aside pane. Optional. */
  aside?: React.ReactNode
  /** Override aside width; defaults to 220. */
  asideWidth?: number
}

export default function LayoutC({
  header,
  children,
  aside,
  asideWidth = 220,
}: Props) {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      {header && (
        <div className="shrink-0 border-b border-[var(--border)]">
          {header}
        </div>
      )}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <section
          style={{ flex: '1 1 0%', minWidth: 0 }}
          className="overflow-y-auto"
        >
          <div className="px-7 py-6">
            {children}
          </div>
        </section>
        {aside && (
          <aside
            style={{ width: asideWidth }}
            className="flex-shrink-0 border-l border-[var(--border)] overflow-y-auto bg-[var(--surface)]"
          >
            {aside}
          </aside>
        )}
      </div>
    </div>
  )
}
