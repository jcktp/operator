'use client'

import { useState } from 'react'
import { Upload, Link2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import UploadTab from './UploadTab'
import RequestTab from './RequestTab'
import SourceProtectionBanner from '@/components/SourceProtectionBanner'
import SourcesTabs from '@/components/SourcesTabs'
import { useMode } from '@/components/ModeContext'

type Tab = 'upload' | 'request'

export default function UploadPage() {
 const modeConfig = useMode()
 const [tab, setTab] = useState<Tab>('upload')

 return (
 <div>
 <SourceProtectionBanner />
 <div className="sticky top-[88px] z-20 bg-[var(--background)] -mx-6 px-6 sm:-mx-8 sm:px-8 mb-6">
 <div className="py-4">
 <h1 className="text-2xl font-semibold text-[var(--text-bright)]">Sources</h1>
 <p className="text-[var(--text-muted)] text-sm mt-0.5">{modeConfig.uploadDescription}</p>
 </div>
 <SourcesTabs active="add" />
 </div>
 <div className="max-w-2xl">
 <div className="flex bg-[var(--surface-2)] rounded-lg p-1 gap-1 mb-3">
 <button onClick={() => setTab('upload')}
 className={cn('flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors',
 tab === 'upload' ? 'bg-[var(--surface)] text-[var(--text-bright)] shadow-sm' : 'text-[var(--text-subtle)] hover:text-[var(--text-body)]')}>
 <Upload size={14} /> Upload now
 </button>
 <button onClick={() => setTab('request')}
 className={cn('flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors',
 tab === 'request' ? 'bg-[var(--surface)] text-[var(--text-bright)] shadow-sm' : 'text-[var(--text-subtle)] hover:text-[var(--text-body)]')}>
 <Link2 size={14} /> Request submission
 </button>
 </div>
 <div className="pb-32">
 {tab === 'upload' ? <UploadTab /> : <RequestTab />}
 </div>
 </div>
 </div>
 )
}
