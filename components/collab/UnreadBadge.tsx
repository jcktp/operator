'use client'

interface Props {
  count: number
  className?: string
}

/** Small red badge showing an unread count. Renders nothing at count = 0. */
export default function UnreadBadge({ count, className = '' }: Props) {
  if (count <= 0) return null
  const label = count > 99 ? '99+' : String(count)
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[16px] h-4 px-0.5 text-[10px] font-bold leading-none rounded-full bg-red-500 text-white ${className}`}
    >
      {label}
    </span>
  )
}
