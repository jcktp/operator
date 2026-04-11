'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2 } from 'lucide-react'

export default function DeleteReportButton({ id }: { id: string }) {
 const router = useRouter()
 const [confirming, setConfirming] = useState(false)
 const [deleting, setDeleting] = useState(false)

 const handleDelete = async () => {
 if (!confirming) {
 setConfirming(true)
 setTimeout(() => setConfirming(false), 3000)
 return
 }
 setDeleting(true)
 await fetch(`/api/reports/${id}`, { method: 'DELETE' })
 router.push('/library')
 router.refresh()
 }

 return (
 <button
 onClick={handleDelete}
 disabled={deleting}
 className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-[4px] border transition-colors ${
 confirming
 ? 'border-[var(--red)] bg-[var(--red-dim)] text-[var(--red)] hover:bg-red-100'
 : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text-body)] hover:border-[var(--border-mid)]'
 }`}
 >
 {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
 {confirming ? 'Confirm delete' : 'Delete'}
 </button>
 )
}
