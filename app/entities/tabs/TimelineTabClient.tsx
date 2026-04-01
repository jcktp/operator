'use client'

import CustomTimeline from './CustomTimeline'
import type { TimelineEvent } from './CustomTimeline'
import TimelineExportButton from './TimelineExportButton'

export default function TimelineTabClient({ events }: { events: TimelineEvent[] }) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <TimelineExportButton events={events} />
      </div>
      <CustomTimeline events={events} />
    </div>
  )
}
