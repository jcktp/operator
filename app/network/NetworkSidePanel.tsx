'use client'

import { X, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { TYPE_COLORS, TYPE_LABELS, ALL_TYPES } from './network-config'
import type { SimNode } from './network-config'

interface ConnectedNode {
 name: string
 type: string
 weight: number
}

interface NetworkSidePanelProps {
 selected: SimNode | null
 clusterActive: boolean
 clusterSize: number
 connectedNodes: ConnectedNode[]
 onClose: () => void
 onToggleCluster: () => void
 onSelectNode: (name: string) => void
}

export default function NetworkSidePanel({
 selected,
 clusterActive,
 clusterSize,
 connectedNodes,
 onClose,
 onToggleCluster,
 onSelectNode,
}: NetworkSidePanelProps) {
 return (
 <div className={cn(
 'shrink-0 border border-[var(--border)] rounded-[10px] overflow-hidden transition-all duration-200',
 selected ? 'w-56' : 'w-44'
 )}>
 {selected ? (
 <div className="p-4 h-full overflow-y-auto space-y-3">
 <div className="flex items-start justify-between gap-2">
 <div>
 <p className="text-xs font-semibold text-[var(--text-bright)] leading-tight">{selected.name}</p>
 <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
 style={{ backgroundColor: TYPE_COLORS[selected.type] ?? '#888' }}>
 {TYPE_LABELS[selected.type] ?? selected.type}
 </span>
 </div>
 <button onClick={onClose}
 className="text-[var(--text-muted)] hover:text-[var(--text-subtle)] shrink-0">
 <X size={13} />
 </button>
 </div>

 <div className="text-xs text-[var(--text-muted)]">
 Appears in <span className="font-semibold text-[var(--text-body)]">{selected.count}</span> document{selected.count !== 1 ? 's' : ''}
 </div>

 <button
 onClick={onToggleCluster}
 className={cn(
 'w-full text-left text-[11px] px-2.5 py-1.5 rounded-[4px] border transition-colors font-medium',
 clusterActive
 ? 'border-[#0026c0] text-[#0026c0] bg-[var(--blue-dim)]'
 : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border)]'
 )}
 >
 {clusterActive
 ? `Cluster (${clusterSize} nodes) — clear`
 : 'Select full cluster'}
 </button>

 {connectedNodes.length > 0 && (
 <div className="space-y-1.5">
 <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">Direct connections</p>
 {connectedNodes.slice(0, 12).map(cn_ => (
 <button key={cn_.name}
 onClick={() => onSelectNode(cn_.name)}
 className="flex items-center justify-between w-full text-left gap-1.5 group">
 <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: TYPE_COLORS[cn_.type] ?? '#888' }} />
 <span className="flex-1 text-[11px] text-[var(--text-body)] truncate group-hover:text-[var(--blue)] transition-colors">{cn_.name}</span>
 <span className="text-[10px] text-[var(--border)] shrink-0">{cn_.weight}</span>
 </button>
 ))}
 </div>
 )}

 <Link href={`/entities/graph?name=${encodeURIComponent(selected.name)}`}
 className="flex items-center gap-1.5 text-[11px] text-[var(--blue)] hover:underline pt-1">
 <ExternalLink size={10} /> Full entity view
 </Link>
 </div>
 ) : (
 <div className="p-4 h-full flex flex-col gap-4 text-[11px] text-[var(--text-muted)]">
 <div>
 <p className="font-semibold text-[var(--text-subtle)] mb-2 text-xs">Controls</p>
 <ul className="space-y-2 leading-relaxed">
 <li><span className="font-medium text-[var(--text-muted)]">Drag</span> background to pan</li>
 <li><span className="font-medium text-[var(--text-muted)]">Drag</span> a node to reposition it</li>
 <li><span className="font-medium text-[var(--text-muted)]">Scroll</span> to zoom</li>
 <li><span className="font-medium text-[var(--text-muted)]">Click</span> to inspect</li>
 <li><span className="font-medium text-[var(--text-muted)]">Dbl-click</span> to highlight cluster &amp; fit view</li>
 </ul>
 </div>
 <div>
 <p className="font-semibold text-[var(--text-muted)] mb-1.5">Legend</p>
 <div className="space-y-1.5">
 {ALL_TYPES.map(t => (
 <div key={t} className="flex items-center gap-2">
 <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: TYPE_COLORS[t] }} />
 <span className="capitalize">{t}</span>
 </div>
 ))}
 </div>
 </div>
 <p className="leading-relaxed">Node size = document count.</p>
 </div>
 )}
 </div>
 )
}
