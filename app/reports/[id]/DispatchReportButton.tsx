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
    setPendingMessage(`Tell me about the "${reportTitle}" report.`)
    setOpen(true)
  }

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-200 hover:border-gray-300 dark:hover:border-zinc-600 hover:text-gray-900 dark:hover:text-zinc-50 transition-colors"
      title="Chat about this report in Dispatch"
    >
      <MessageSquare size={12} />
      Ask Dispatch
    </button>
  )
}
