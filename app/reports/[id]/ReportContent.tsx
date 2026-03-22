'use client'

import { useDispatch } from '@/components/DispatchContext'

export default function ReportContent({ children }: { children: React.ReactNode }) {
  const { open } = useDispatch()
  return (
    <div className={open ? 'space-y-8 max-w-full' : 'space-y-8 max-w-3xl'}>
      {children}
    </div>
  )
}
