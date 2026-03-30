'use client'

import dynamic from 'next/dynamic'
import type { TimelineJSData } from './TimelineJSViewer'

const TimelineJSViewer = dynamic(() => import('./TimelineJSViewer'), { ssr: false })

export default function TimelineTabClient({ data }: { data: TimelineJSData }) {
  return <TimelineJSViewer data={data} />
}
