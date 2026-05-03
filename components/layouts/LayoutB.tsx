/**
 * Layout B — Sidebar + scrolling content
 * ────────────────────────────────────────────────────────────────────────
 * Per layout-reference.html: sidebar(196) | content(flex-1, max-w 640).
 * Sidebar scrolls independently; content scrolls.
 *
 * Used by: Settings, Notebook (Journal).
 */
import type React from 'react'

interface Props {
  sidebar: React.ReactNode
  children: React.ReactNode
  /** Override sidebar width if needed; defaults to 196. */
  sidebarWidth?: number
  /** Override content max-width; defaults to 640. */
  contentMaxWidth?: number | null
}

export default function LayoutB({
  sidebar,
  children,
  sidebarWidth = 196,
  contentMaxWidth = 640,
}: Props) {
  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      <aside
        style={{ width: sidebarWidth }}
        className="flex-shrink-0 border-r border-[var(--border)] h-full overflow-y-auto bg-[var(--surface)]"
      >
        {sidebar}
      </aside>
      <section
        style={{ flex: '1 1 0%', minWidth: 0 }}
        className="overflow-y-auto"
      >
        <div
          className="px-7 py-6"
          style={contentMaxWidth ? { maxWidth: contentMaxWidth } : undefined}
        >
          {children}
        </div>
      </section>
    </div>
  )
}
