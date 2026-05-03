/**
 * Layout A — Three-column fixed
 * ────────────────────────────────────────────────────────────────────────
 * Per layout-reference.html: sidebar(256) | content(flex-1) | aside(220).
 * Each pane scrolls independently; outer container does not scroll.
 * Header is sticky at the top.
 *
 * Used by: Overview, Library, Stories, Files (and any 3-column page).
 */
import type React from 'react'

interface Props {
  /** Optional page title row above the body. Sticky. */
  header?: React.ReactNode
  /** Left sidebar pane (lists, navigation, story chooser). */
  sidebar: React.ReactNode
  /** Center content pane. */
  children: React.ReactNode
  /** Right aside pane (timeline, inspector). Optional. */
  aside?: React.ReactNode
  /** Override widths if needed; defaults match the spec. */
  sidebarWidth?: number
  asideWidth?: number
}

export default function LayoutA({
  header,
  sidebar,
  children,
  aside,
  sidebarWidth = 256,
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
        <aside
          style={{ width: sidebarWidth }}
          className="flex-shrink-0 border-r border-[var(--border)] flex flex-col h-full overflow-hidden bg-[var(--surface)]"
        >
          {sidebar}
        </aside>
        <section
          style={{ flex: '1 1 0%', minWidth: 0 }}
          className="overflow-y-auto"
        >
          {children}
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
