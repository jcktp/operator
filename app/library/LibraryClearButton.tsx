'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

export default function LibraryClearButton() {
 const [confirm, setConfirm] = useState(false)
 const [clearing, setClearing] = useState(false)
 const router = useRouter()

 const handleClick = async () => {
 if (!confirm) {
 setConfirm(true)
 setTimeout(() => setConfirm(false), 3500)
 return
 }
 setClearing(true)
 await fetch('/api/reports/clear', { method: 'DELETE' })
 setClearing(false)
 setConfirm(false)
 router.refresh()
 }

 return (
 <button
 onClick={handleClick}
 disabled={clearing}
 className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-[4px] border transition-colors ${
 confirm
 ? 'bg-[var(--red-dim)] text-[var(--red)] border-[var(--red)] hover:bg-red-100'
 : 'text-[var(--text-muted)] border-[var(--border)] hover:text-[var(--text-body)] hover:border-[var(--border)]'
 }`}
 >
 <Trash2 size={12} />
 {clearing ? 'Clearing…' : confirm ? 'Delete all reports?' : 'Clear all'}
 </button>
 )
}
