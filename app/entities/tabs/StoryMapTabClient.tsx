'use client'

import dynamic from 'next/dynamic'
import type { RawLocation } from './StoryMapClient'

const StoryMapClient = dynamic(() => import('./StoryMapClient'), { ssr: false })

export default function StoryMapTabClient({ locations }: { locations: RawLocation[] }) {
  return <StoryMapClient locations={locations} />
}
