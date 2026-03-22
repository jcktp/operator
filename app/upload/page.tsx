'use client'

import { useState } from 'react'
import { Upload, Link2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import UploadTab from './UploadTab'
import RequestTab from './RequestTab'

type Tab = 'upload' | 'request'

export default function UploadPage() {
  const [tab, setTab] = useState<Tab>('upload')

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Add reports</h1>
        <p className="text-gray-500 text-sm mt-0.5">Upload directly or send a link for someone to submit their own report.</p>
      </div>
      <div className="flex bg-gray-100 rounded-lg p-1 gap-1 mb-6">
        <button onClick={() => setTab('upload')}
          className={cn('flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors',
            tab === 'upload' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
          <Upload size={14} /> Upload now
        </button>
        <button onClick={() => setTab('request')}
          className={cn('flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors',
            tab === 'request' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
          <Link2 size={14} /> Request submission
        </button>
      </div>
      {tab === 'upload' ? <UploadTab /> : <RequestTab />}
    </div>
  )
}
