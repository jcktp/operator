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
 // Guard against malformed AI responses stored in DB: ensure string arrays contain only strings
 const safePassages = comparison.passages.filter(
 p => p && typeof p.text === 'string' && typeof p.appearsIn === 'string'
 )
 const safeEntitiesAdded = comparison.entitiesAdded.filter(e => typeof e === 'string')
 const safeEntitiesRemoved = comparison.entitiesRemoved.filter(e => typeof e === 'string')
 const safeRedactions = comparison.possibleRedactions.filter(r => typeof r === 'string')

 const hasContent =
 safePassages.length > 0 ||
 comparison.figures.length > 0 ||
 safeEntitiesAdded.length > 0 ||
 safeEntitiesRemoved.length > 0 ||
 safeRedactions.length > 0

 if (!hasContent && !comparison.headline) return null

 return (
 <section>
 <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
 <GitCompare size={11} />
 Document comparison
 {prevTitle && (
 <span className="ml-1 text-[var(--border)] font-normal normal-case tracking-normal">
 · vs {prevTitle}
 </span>
 )}
 </h2>
 <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] overflow-hidden">
 {comparison.headline && (
 <div className="px-4 py-3 bg-[var(--surface-2)] border-b border-[var(--border)]">
 <p className="text-sm font-medium text-[var(--text-body)]">{comparison.headline}</p>
 </div>
 )}

 {/* Passages */}
 {safePassages.length > 0 && (
 <div className="px-4 py-3 border-b border-[var(--border)]">
 <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Claims & passages</p>
 <div className="space-y-2">
 {safePassages.map((p, i) => (
 <div key={i} className="flex items-start gap-2">
 <span className={`shrink-0 mt-0.5 ${p.appearsIn === 'current' ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
 {p.appearsIn === 'current' ? <Plus size={12} /> : <Minus size={12} />}
 </span>
 <p className="text-sm text-[var(--text-body)]">{p.text}</p>
 <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${
 p.appearsIn === 'current'
 ? 'bg-[var(--green-dim)] text-[var(--green)]'
 : 'bg-[var(--red-dim)] text-[var(--red)]'
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
 <div className="px-4 py-3 border-b border-[var(--border)]">
 <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Changed figures</p>
 <div className="space-y-1.5">
 {comparison.figures.map((f, i) => (
 <div key={i} className="flex items-start gap-3">
 <RefreshCw size={11} className="shrink-0 mt-1 text-amber-500" />
 <div className="flex-1 min-w-0">
 <span className="text-sm font-medium text-[var(--text-bright)]">{f.label}: </span>
 <span className="text-xs text-[var(--text-muted)] line-through">{f.previous}</span>
 <span className="text-xs text-[var(--text-muted)] mx-1">→</span>
 <span className="text-sm font-medium text-[var(--text-bright)]">{f.current}</span>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Entity changes */}
 {(safeEntitiesAdded.length > 0 || safeEntitiesRemoved.length > 0) && (
 <div className="px-4 py-3 border-b border-[var(--border)] flex gap-6 flex-wrap">
 {safeEntitiesAdded.length > 0 && (
 <div>
 <p className="text-xs font-medium text-[var(--text-muted)] mb-1">Named entities added</p>
 <div className="flex flex-wrap gap-1">
 {safeEntitiesAdded.map((e, i) => (
 <span key={i} className="text-xs bg-[var(--green-dim)] text-[var(--green)] border border-[var(--green)] px-2 py-0.5 rounded-[4px]">
 + {e}
 </span>
 ))}
 </div>
 </div>
 )}
 {safeEntitiesRemoved.length > 0 && (
 <div>
 <p className="text-xs font-medium text-[var(--text-muted)] mb-1">Named entities removed</p>
 <div className="flex flex-wrap gap-1">
 {safeEntitiesRemoved.map((e, i) => (
 <span key={i} className="text-xs bg-[var(--red-dim)] text-[var(--red)] border border-[var(--red)] px-2 py-0.5 rounded-[4px]">
 − {e}
 </span>
 ))}
 </div>
 </div>
 )}
 </div>
 )}

 {/* Possible redactions */}
 {safeRedactions.length > 0 && (
 <div className="px-4 py-3">
 <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2 flex items-center gap-1">
 <EyeOff size={10} />
 Possible redactions
 </p>
 <div className="space-y-1.5">
 {safeRedactions.map((r, i) => (
 <p key={i} className="text-sm text-[var(--text-subtle)] flex items-start gap-2">
 <span className="shrink-0 text-[var(--red)] mt-0.5">▪</span>
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
