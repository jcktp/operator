'use client'

import { Printer } from 'lucide-react'

export default function OnePagerClient({ reportCount }: { reportCount: number }) {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:border-gray-300 hover:text-gray-900 transition-colors print:hidden"
    >
      <Printer size={14} />
      Print / PDF
    </button>
  )
}
