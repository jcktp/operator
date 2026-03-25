/**
 * Streamline-style SVG icons (Tabler / Streamline aesthetic)
 * Drop-in replacements for lucide-react — same size prop interface.
 */

type P = { size?: number; className?: string }

function base(size: number, className?: string) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
  }
}

export function LayoutDashboard({ size = 16, className }: P) {
  return (
    <svg {...base(size, className)}>
      <path d="M5 4h4a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
      <path d="M5 16h4a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1z" />
      <path d="M15 12h4a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1z" />
      <path d="M15 4h4a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
    </svg>
  )
}

export function BarChart2({ size = 16, className }: P) {
  return (
    <svg {...base(size, className)}>
      <path d="M3 12a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
      <path d="M9 7a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1z" />
      <path d="M15 4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1z" />
    </svg>
  )
}

export function Upload({ size = 16, className }: P) {
  return (
    <svg {...base(size, className)}>
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
      <path d="M7 9l5-5 5 5" />
      <path d="M12 4v12" />
    </svg>
  )
}

export function Library({ size = 16, className }: P) {
  return (
    <svg {...base(size, className)}>
      <path d="M3 19a9 9 0 0 1 9 0 9 9 0 0 1 9 0" />
      <path d="M3 6a9 9 0 0 1 9 0 9 9 0 0 1 9 0" />
      <path d="M3 6v13" />
      <path d="M12 6v13" />
      <path d="M21 6v13" />
    </svg>
  )
}

export function Users({ size = 16, className }: P) {
  return (
    <svg {...base(size, className)}>
      <circle cx="9" cy="7" r="4" />
      <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      <path d="M21 21v-2a4 4 0 0 0-3-3.85" />
    </svg>
  )
}

export function BookOpen({ size = 16, className }: P) {
  return (
    <svg {...base(size, className)}>
      <path d="M12 7v14" />
      <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1c2.4 0 4.8.6 6.9 1.8L12 6l2.1-1.2C16.2 3.6 18.6 3 21 3a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1c-2.4 0-4.8.6-6.9 1.8L12 20l-2.1-1.2C7.8 17.6 5.4 18 3 18z" />
    </svg>
  )
}

/** Activity / pulse waveform — used for the "Pulse" nav item */
export function Radio({ size = 16, className }: P) {
  return (
    <svg {...base(size, className)}>
      <path d="M3 12h3l3-9 3 18 3-9h6" />
    </svg>
  )
}

export function MessageSquare({ size = 16, className }: P) {
  return (
    <svg {...base(size, className)}>
      <path d="M3 20l1.5-4.5A9 9 0 1 1 7.5 17.5L3 20" />
    </svg>
  )
}

export function Settings({ size = 16, className }: P) {
  return (
    <svg {...base(size, className)}>
      <path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

export function Power({ size = 16, className }: P) {
  return (
    <svg {...base(size, className)}>
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
      <path d="M12 2v10" />
    </svg>
  )
}

export function Search({ size = 16, className }: P) {
  return (
    <svg {...base(size, className)}>
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  )
}

export function ChevronDown({ size = 16, className }: P) {
  return (
    <svg {...base(size, className)}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

export function LogOut({ size = 16, className }: P) {
  return (
    <svg {...base(size, className)}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  )
}
