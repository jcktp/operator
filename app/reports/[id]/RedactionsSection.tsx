import { EyeOff } from 'lucide-react'

export interface RedactionItem {
  type: 'blackout' | 'placeholder' | 'gap' | 'missing_reference'
  location: string
  context: string
}

const TYPE_LABELS: Record<RedactionItem['type'], string> = {
  blackout: 'Blacked out',
  placeholder: 'Placeholder',
  gap: 'Gap',
  missing_reference: 'Missing ref',
}

const TYPE_COLORS: Record<RedactionItem['type'], string> = {
  blackout: 'bg-red-50 text-red-700 border-red-200',
  placeholder: 'bg-orange-50 text-orange-700 border-orange-200',
  gap: 'bg-amber-50 text-amber-700 border-amber-200',
  missing_reference: 'bg-gray-50 text-gray-600 border-gray-200',
}

export default function RedactionsSection({ redactions }: { redactions: RedactionItem[] }) {
  if (redactions.length === 0) return null

  return (
    <section>
      <h2 className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <EyeOff size={11} />
        Redactions
        <span className="ml-1 px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-300 text-xs font-medium normal-case tracking-normal">
          {redactions.length} detected
        </span>
      </h2>
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl divide-y divide-gray-100 dark:divide-zinc-800">
        {redactions.map((r, i) => (
          <div key={i} className="flex items-start gap-3 px-4 py-3">
            <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border mt-0.5 ${TYPE_COLORS[r.type]}`}>
              {TYPE_LABELS[r.type]}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">{r.location}</p>
              <p className="text-sm text-gray-600 dark:text-zinc-300 italic leading-relaxed">&ldquo;{r.context}&rdquo;</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
