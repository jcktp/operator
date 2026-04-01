'use client'

import { useInspector } from '@/components/InspectorContext'

export default function ReportContent({ children }: { children: React.ReactNode }) {
  const { open: inspectorOpen } = useInspector()
  return (
    <div className={inspectorOpen ? 'space-y-8 max-w-full' : 'space-y-8 max-w-3xl'}>
      {children}
    </div>
  )
}
