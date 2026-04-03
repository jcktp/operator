'use client'

import dynamic from 'next/dynamic'
import { useInspector } from '@/components/InspectorContext'
import { useDispatch } from '@/components/DispatchContext'

const DispatchPanel = dynamic(() => import('@/app/dispatch/DispatchPanel'), { ssr: false })

const SCROLL_MASK = {
  WebkitMaskImage: 'linear-gradient(to bottom, transparent 0px, black 28px)',
  maskImage: 'linear-gradient(to bottom, transparent 0px, black 28px)',
} as React.CSSProperties

export default function ReportContent({
  header,
  docSlot,
  analysisSlot,
  currentProjectId,
  currentProjectName,
}: {
  header: React.ReactNode
  docSlot: React.ReactNode
  analysisSlot: React.ReactNode
  currentProjectId?: string | null
  currentProjectName?: string | null
}) {
  const { open: inspectorOpen } = useInspector()
  const { open: dispatchOpen, setOpen: setDispatchOpen, aiContext, pendingMessage, setPendingMessage } = useDispatch()

  const closeDispatch = () => { setDispatchOpen(false); setPendingMessage('') }

  return (
    <div className={`flex flex-col h-full ${inspectorOpen ? 'max-w-full' : 'max-w-[1600px]'}`}>
      {/* Header — always visible */}
      <div className="shrink-0 pb-4 space-y-3">
        {header}
      </div>

      {/* Split panes — fill remaining viewport height */}
      <div className="flex-1 min-h-0 flex gap-6 pb-4">
        {/* Left pane: document preview — unchanged width */}
        <div
          className="w-5/12 shrink-0 overflow-y-auto rounded-xl"
          style={SCROLL_MASK}
        >
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-4 pt-6">
            {docSlot}
          </div>
        </div>

        {/* Right side: analysis + optional dispatch panel side by side */}
        <div className="flex-1 min-w-0 flex gap-4">
          {/* Analysis pane — scrolls independently, narrows when dispatch is open */}
          <div
            className="flex-1 min-w-0 overflow-y-auto"
            style={SCROLL_MASK}
          >
            <div className="space-y-6 pt-2 pb-8">
              {analysisSlot}
            </div>
          </div>

          {/* Dispatch panel — opens to the right of analysis */}
          {dispatchOpen && (
            <div className="w-72 shrink-0 flex flex-col overflow-hidden">
              <DispatchPanel
                key={aiContext}
                context={aiContext}
                onClose={closeDispatch}
                initialMessage={pendingMessage || undefined}
                currentProjectId={currentProjectId ?? null}
                currentProjectName={currentProjectName ?? null}
                compact
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
