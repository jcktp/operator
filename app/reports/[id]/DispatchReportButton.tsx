'use client'

import { MessageSquare } from 'lucide-react'
import { useDispatch } from '@/components/DispatchContext'

interface Props {
 reportId: string
 reportTitle: string
 reportContext: string
}

export default function DispatchReportButton({ reportTitle, reportContext }: Props) {
 const { setOpen, setAiContext, setPendingMessage } = useDispatch()

 const handleClick = () => {
 setAiContext(reportContext)
 setPendingMessage(`Tell me about the"${reportTitle} "report.`)
 setOpen(true)
 }

 return (
 <button
 onClick={handleClick}
 className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-subtle)] hover:border-[var(--border-mid)] hover:text-[var(--text-bright)] transition-colors"
 title="Chat about this report in Dispatch"
 >
 <MessageSquare size={12} />
 Ask Dispatch
 </button>
 )
}
