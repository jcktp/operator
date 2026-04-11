'use client'

import { useState, useRef } from 'react'
import PreviewCard from './PreviewCard'

interface Props {
  refType: 'entity' | 'document' | 'timeline'
  refId: string
  label: string
  projectId: string
}

const TYPE_STYLES: Record<string, string> = {
  entity:   'bg-blue-50 text-blue-700 border-blue-200',
  document: 'bg-purple-50 text-purple-700 border-purple-200',
  timeline: 'bg-amber-50 text-amber-700 border-amber-200',
}

const TYPE_PREFIX: Record<string, string> = {
  entity:   '',
  document: 'doc: ',
  timeline: 'event: ',
}

export default function ReferenceChip({ refType, refId, label, projectId }: Props) {
  const [showPreview, setShowPreview] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => setShowPreview(true), 300)
  }
  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setShowPreview(false)
  }

  return (
    <span className="relative inline-block">
      <span
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[11px] font-medium cursor-default select-none ${TYPE_STYLES[refType] ?? TYPE_STYLES.entity}`}
      >
        →{TYPE_PREFIX[refType]}{label}
      </span>
      {showPreview && (
        <span
          className="absolute bottom-full left-0 mb-1 z-50 pointer-events-none"
          onMouseEnter={() => setShowPreview(true)}
          onMouseLeave={handleMouseLeave}
        >
          <PreviewCard refType={refType} refId={refId} label={label} projectId={projectId} />
        </span>
      )}
    </span>
  )
}
