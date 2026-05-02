'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

const DEFAULT_PAGE_SIZE = 10

export default function Pagination({
  page,
  total,
  onPage,
  pageSize = DEFAULT_PAGE_SIZE,
}: {
  page: number
  total: number
  onPage: (p: number) => void
  pageSize?: number
}) {
  const pages = Math.ceil(total / pageSize)
  if (pages <= 1) return null
  return (
    <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
      <span className="text-xs text-[var(--text-muted)]">{total} items · page {page + 1} of {pages}</span>
      <div className="flex gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 0}
          className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-subtle)] disabled:opacity-30 disabled:cursor-default"
        >
          <ChevronLeft size={14} />
        </button>
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= pages - 1}
          className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-subtle)] disabled:opacity-30 disabled:cursor-default"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}
