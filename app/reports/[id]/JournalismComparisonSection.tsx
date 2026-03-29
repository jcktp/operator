import { GitCompare, Plus, Minus, RefreshCw, EyeOff } from 'lucide-react'

export interface JournalismComparisonData {
  headline: string
  passages: Array<{ text: string; appearsIn: 'previous' | 'current' }>
  figures: Array<{ label: string; previous: string; current: string }>
  entitiesAdded: string[]
  entitiesRemoved: string[]
  possibleRedactions: string[]
}

export default function JournalismComparisonSection({
  comparison,
  prevTitle,
}: {
  comparison: JournalismComparisonData
  prevTitle?: string
}) {
  const hasContent =
    comparison.passages.length > 0 ||
    comparison.figures.length > 0 ||
    comparison.entitiesAdded.length > 0 ||
    comparison.entitiesRemoved.length > 0 ||
    comparison.possibleRedactions.length > 0

  if (!hasContent && !comparison.headline) return null

  return (
    <section>
      <h2 className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <GitCompare size={11} />
        Document comparison
        {prevTitle && (
          <span className="ml-1 text-gray-300 dark:text-zinc-600 font-normal normal-case tracking-normal">
            · vs {prevTitle}
          </span>
        )}
      </h2>
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl overflow-hidden">
        {comparison.headline && (
          <div className="px-4 py-3 bg-gray-50 dark:bg-zinc-800 border-b border-gray-100 dark:border-zinc-700">
            <p className="text-sm font-medium text-gray-800 dark:text-zinc-100">{comparison.headline}</p>
          </div>
        )}

        {/* Passages */}
        {comparison.passages.length > 0 && (
          <div className="px-4 py-3 border-b border-gray-100 dark:border-zinc-800">
            <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2">Claims & passages</p>
            <div className="space-y-2">
              {comparison.passages.map((p, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className={`shrink-0 mt-0.5 ${p.appearsIn === 'current' ? 'text-green-600' : 'text-red-500'}`}>
                    {p.appearsIn === 'current' ? <Plus size={12} /> : <Minus size={12} />}
                  </span>
                  <p className="text-sm text-gray-700 dark:text-zinc-200">{p.text}</p>
                  <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${
                    p.appearsIn === 'current'
                      ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300'
                      : 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-300'
                  }`}>
                    {p.appearsIn === 'current' ? 'added' : 'removed'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Figures */}
        {comparison.figures.length > 0 && (
          <div className="px-4 py-3 border-b border-gray-100 dark:border-zinc-800">
            <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2">Changed figures</p>
            <div className="space-y-1.5">
              {comparison.figures.map((f, i) => (
                <div key={i} className="flex items-start gap-3">
                  <RefreshCw size={11} className="shrink-0 mt-1 text-amber-500" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-900 dark:text-zinc-50">{f.label}: </span>
                    <span className="text-xs text-gray-400 dark:text-zinc-500 line-through">{f.previous}</span>
                    <span className="text-xs text-gray-400 dark:text-zinc-500 mx-1">→</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-zinc-50">{f.current}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Entity changes */}
        {(comparison.entitiesAdded.length > 0 || comparison.entitiesRemoved.length > 0) && (
          <div className="px-4 py-3 border-b border-gray-100 dark:border-zinc-800 flex gap-6 flex-wrap">
            {comparison.entitiesAdded.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Named entities added</p>
                <div className="flex flex-wrap gap-1">
                  {comparison.entitiesAdded.map((e, i) => (
                    <span key={i} className="text-xs bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 px-2 py-0.5 rounded-full">
                      + {e}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {comparison.entitiesRemoved.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Named entities removed</p>
                <div className="flex flex-wrap gap-1">
                  {comparison.entitiesRemoved.map((e, i) => (
                    <span key={i} className="text-xs bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-800 px-2 py-0.5 rounded-full">
                      − {e}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Possible redactions */}
        {comparison.possibleRedactions.length > 0 && (
          <div className="px-4 py-3">
            <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1">
              <EyeOff size={10} />
              Possible redactions
            </p>
            <div className="space-y-1.5">
              {comparison.possibleRedactions.map((r, i) => (
                <p key={i} className="text-sm text-gray-600 dark:text-zinc-300 flex items-start gap-2">
                  <span className="shrink-0 text-red-400 mt-0.5">▪</span>
                  {r}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
