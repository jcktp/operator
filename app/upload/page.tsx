'use client'

import { useState } from 'react'
import { Upload, Link2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import UploadTab from './UploadTab'
import RequestTab from './RequestTab'
import SourceProtectionBanner from '@/components/SourceProtectionBanner'
import { useMode } from '@/components/ModeContext'

type Tab = 'upload' | 'request'

export default function UploadPage() {
  const modeConfig = useMode()
  const [tab, setTab] = useState<Tab>('upload')

  return (
    <div className="max-w-2xl">
      <SourceProtectionBanner />
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-zinc-50">{modeConfig.uploadTitle}</h1>
        <p className="text-gray-500 dark:text-zinc-400 text-sm mt-0.5">{modeConfig.uploadDescription}</p>
      </div>
      <div className="flex bg-gray-100 dark:bg-zinc-800 rounded-lg p-1 gap-1 mb-6">
        <button onClick={() => setTab('upload')}
          className={cn('flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors',
            tab === 'upload' ? 'bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-50 shadow-sm' : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200')}>
          <Upload size={14} /> Upload now
        </button>
        <button onClick={() => setTab('request')}
          className={cn('flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors',
            tab === 'request' ? 'bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-50 shadow-sm' : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200')}>
          <Link2 size={14} /> Request submission
        </button>
      </div>
      {tab === 'upload' ? <UploadTab /> : <RequestTab />}
    </div>
  )
}
