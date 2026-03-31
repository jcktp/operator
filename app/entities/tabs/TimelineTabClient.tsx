'use client'

import CustomTimeline from './CustomTimeline'
import type { TimelineEvent } from './CustomTimeline'

export default function TimelineTabClient({ events }: { events: TimelineEvent[] }) {
  return <CustomTimeline events={events} />
}
