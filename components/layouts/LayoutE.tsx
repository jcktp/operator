/**
 * Layout E — Chat
 * ────────────────────────────────────────────────────────────────────────
 * Per layout-reference.html: persona sidebar(204) | thread(flex-1) | input bar at bottom.
 * Sidebar scrolls. Thread scrolls. Input bar is fixed at the bottom of the thread column.
 *
 * Used by: Dispatch.
 */
import type React from 'react'

interface Props {
  sidebar: React.ReactNode
  /** Optional thread header (persona row). */
  threadHeader?: React.ReactNode
  /** Scrollable thread body. */
  children: React.ReactNode
  /** Fixed input bar at the bottom. */
  inputBar: React.ReactNode
  /** Override sidebar width; defaults to 204. */
  sidebarWidth?: number
}

export default function LayoutE({
  sidebar,
  threadHeader,
  children,
  inputBar,
  sidebarWidth = 204,
}: Props) {
  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      <aside
        style={{ width: sidebarWidth }}
        className="flex-shrink-0 border-r border-[var(--border)] flex flex-col h-full overflow-hidden bg-[var(--surface-2)]"
      >
        {sidebar}
      </aside>
      <section
        style={{ flex: '1 1 0%', minWidth: 0 }}
        className="flex flex-col h-full"
      >
        {threadHeader && (
          <div className="shrink-0 border-b border-[var(--border)]">
            {threadHeader}
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {children}
        </div>
        <div className="shrink-0 border-t border-[var(--border)]">
          {inputBar}
        </div>
      </section>
    </div>
  )
}
