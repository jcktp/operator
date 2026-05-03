'use client'

import { useCallback, useRef, useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, Trash2 } from 'lucide-react'

export interface OutlineEvent {
  id: string
  date: string
  description: string
  actors: string[]
  claimId?: string
}

interface Props {
  entryId: string
  initial: OutlineEvent[]
  onChange?: (events: OutlineEvent[]) => void
}

const SAVE_DEBOUNCE_MS = 800

function makeId(): string {
  return 'e' + Math.random().toString(36).slice(2, 10)
}

export default function OutlineEditor({ entryId, initial, onChange }: Props) {
  const [events, setEvents] = useState<OutlineEvent[]>(initial)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const persist = useCallback((next: OutlineEvent[]) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      await fetch(`/api/journal/${entryId}/structure`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: JSON.stringify(next) }),
      })
    }, SAVE_DEBOUNCE_MS)
  }, [entryId])

  const update = (next: OutlineEvent[]) => {
    setEvents(next)
    onChange?.(next)
    persist(next)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = events.findIndex(e => e.id === active.id)
    const newIndex = events.findIndex(e => e.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    update(arrayMove(events, oldIndex, newIndex))
  }

  const addEvent = () => {
    update([...events, { id: makeId(), date: '', description: '', actors: [] }])
  }

  const removeEvent = (id: string) => {
    update(events.filter(e => e.id !== id))
  }

  const editEvent = (id: string, patch: Partial<OutlineEvent>) => {
    update(events.map(e => e.id === id ? { ...e, ...patch } : e))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Outline</p>
        <button
          onClick={addEvent}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--text-body)] hover:bg-[var(--surface-2)] transition-colors"
        >
          <Plus size={11} /> Event
        </button>
      </div>

      {events.length === 0 ? (
        <p className="text-[11px] text-[var(--text-muted)] italic">No events yet — click + Event to start.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={events.map(e => e.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1.5">
              {events.map(ev => (
                <SortableEventRow
                  key={ev.id}
                  event={ev}
                  onEdit={patch => editEvent(ev.id, patch)}
                  onRemove={() => removeEvent(ev.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}

function SortableEventRow({
  event,
  onEdit,
  onRemove,
}: {
  event: OutlineEvent
  onEdit: (patch: Partial<OutlineEvent>) => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: event.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-[4px] px-2 py-2 group"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="shrink-0 mt-0.5 text-[var(--text-muted)] hover:text-[var(--text-body)] cursor-grab active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical size={12} />
      </button>
      <div className="flex-1 min-w-0 space-y-1">
        <input
          value={event.date}
          onChange={e => onEdit({ date: e.target.value })}
          placeholder="Date"
          className="w-full text-[11px] bg-transparent border-b border-transparent hover:border-[var(--border)] focus:border-[var(--border-mid)] focus:outline-none text-[var(--text-muted)] py-0.5"
        />
        <textarea
          value={event.description}
          onChange={e => onEdit({ description: e.target.value })}
          placeholder="What happened…"
          rows={1}
          className="w-full text-xs bg-transparent border-b border-transparent hover:border-[var(--border)] focus:border-[var(--border-mid)] focus:outline-none text-[var(--text-bright)] resize-none py-0.5"
        />
        {event.actors.length > 0 && (
          <p className="text-[10px] text-[var(--text-muted)]">{event.actors.join(', ')}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 mt-0.5 text-[var(--text-muted)] hover:text-[var(--red)] opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Remove event"
      >
        <Trash2 size={11} />
      </button>
    </div>
  )
}
