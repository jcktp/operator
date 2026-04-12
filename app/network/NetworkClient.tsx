'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Loader2, RefreshCw, Maximize2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NetworkData, NetworkEdge } from '@/app/api/entities/network/route'
import { TYPE_COLORS, ALL_TYPES, ALPHA_START, ALPHA_DECAY } from './network-config'
import type { SimNode } from './network-config'
import { initNodes, tick } from './network-sim'
import NetworkSidePanel from './NetworkSidePanel'

export default function NetworkClient() {
 const canvasRef = useRef<HTMLCanvasElement>(null)
 const containerRef = useRef<HTMLDivElement>(null)
 const nodesRef = useRef<SimNode[]>([])
 const edgesRef = useRef<NetworkEdge[]>([])
 const alphaRef = useRef(0)
 const cssSizeRef = useRef({ w: 0, h: 0 })
 const panRef = useRef({ x: 0, y: 0 })
 const scaleRef = useRef(1)
 const hoveredRef = useRef<string | null>(null)
 const selectedRef = useRef<string | null>(null)
 const clusterRef = useRef<Set<string> | null>(null)
 const dragRef = useRef<{ type: 'node'; id: string; ox: number; oy: number } | { type: 'pan'; sx: number; sy: number; px: number; py: number } | null>(null)
 const [rawData, setRawData] = useState<NetworkData | null>(null)
 const [loading, setLoading] = useState(true)
 const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set(ALL_TYPES))
 const [hoveredName, setHoveredName] = useState<string | null>(null)
 const [selected, setSelected] = useState<SimNode | null>(null)
 const [clusterActive, setClusterActive] = useState(false)

 const syncCanvas = useCallback(() => {
  const canvas = canvasRef.current; const el = containerRef.current
  if (!canvas || !el) return
  const w = el.clientWidth; const h = el.clientHeight
  const dpr = window.devicePixelRatio ?? 1
  const pw = Math.round(w * dpr); const ph = Math.round(h * dpr)
  if (canvas.width !== pw || canvas.height !== ph) {
   if (cssSizeRef.current.w === 0) {
    panRef.current = { x: w / 2, y: h / 2 }
   }
   canvas.width = pw; canvas.height = ph
   canvas.style.width = `${w}px`; canvas.style.height = `${h}px`
   cssSizeRef.current = { w, h }
  }
 }, [])

 const toWorld = useCallback((sx: number, sy: number) => {
  const { x: px, y: py } = panRef.current; const s = scaleRef.current
  return { x: (sx - px) / s, y: (sy - py) / s }
 }, [])

 const load = useCallback(async () => {
  setLoading(true)
  try {
   const res = await fetch('/api/entities/network?limit=80&minCount=1')
   if (res.ok) setRawData(await res.json() as NetworkData)
  } catch { /* silent */ }
  finally { setLoading(false) }
 }, [])

 useEffect(() => { void load() }, [load])

 useEffect(() => {
  if (!rawData) return
  const nodes = rawData.nodes.filter(n => activeTypes.has(n.type))
  const ids = new Set(nodes.map(n => n.id))
  const edges = rawData.edges.filter(e => ids.has(e.source) && ids.has(e.target))
  nodesRef.current = initNodes(nodes)
  edgesRef.current = edges
  alphaRef.current = ALPHA_START
  hoveredRef.current = null
  selectedRef.current = null
  clusterRef.current = null
  dragRef.current = null
  setSelected(null); setClusterActive(false)
 }, [rawData, activeTypes])

 const fitView = useCallback((ids?: Set<string>) => {
  const nodes = ids
   ? nodesRef.current.filter(n => ids.has(n.id))
   : nodesRef.current
  if (!nodes.length) return
  const { w, h } = cssSizeRef.current; if (!w) return
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const n of nodes) {
   minX = Math.min(minX, n.x - n.r); maxX = Math.max(maxX, n.x + n.r)
   minY = Math.min(minY, n.y - n.r); maxY = Math.max(maxY, n.y + n.r)
  }
  const bw = maxX - minX + 80; const bh = maxY - minY + 80
  const s = Math.min(1.6, Math.min(w / bw, h / bh))
  const cx = (minX + maxX) / 2; const cy = (minY + maxY) / 2
  scaleRef.current = s
  panRef.current = { x: w / 2 - cx * s, y: h / 2 - cy * s }
 }, [])

 useEffect(() => {
  let alive = true
  const frame = () => {
   if (!alive) return
   syncCanvas()
   const canvas = canvasRef.current
   if (!canvas) { requestAnimationFrame(frame); return }
   const ctx = canvas.getContext('2d')
   if (!ctx) { requestAnimationFrame(frame); return }

   const { w, h } = cssSizeRef.current; const dpr = window.devicePixelRatio ?? 1
   const nodes = nodesRef.current; const edges = edgesRef.current
   let alpha = alphaRef.current
   if (alpha > 0.001 && nodes.length > 0) {
    tick(nodes, edges, alpha)
    alpha = Math.max(0, alpha - ALPHA_DECAY); alphaRef.current = alpha
   }
   ctx.setTransform(1, 0, 0, 1, 0, 0)
   ctx.clearRect(0, 0, canvas.width, canvas.height)
   if (nodes.length === 0) { requestAnimationFrame(frame); return }
   const { x: px, y: py } = panRef.current; const s = scaleRef.current
   const hov = hoveredRef.current; const sel = selectedRef.current; const cluster = clusterRef.current
   const connectedToSel = sel
    ? new Set(edges.flatMap(e => e.source === sel ? [e.target] : e.target === sel ? [e.source] : []))
    : null
   const dim = (id: string) => {
    if (cluster) return !cluster.has(id)
    return !!sel && id !== sel && !connectedToSel?.has(id)
   }
   ctx.setTransform(dpr * s, 0, 0, dpr * s, px * dpr, py * dpr)
   for (const edge of edges) {
    const a = nodes.find(n => n.id === edge.source)
    const b = nodes.find(n => n.id === edge.target)
    if (!a || !b) continue
    const isSelEdge = sel && (edge.source === sel || edge.target === sel)
    const isHovEdge = !sel && (hov === edge.source || hov === edge.target)
    ctx.beginPath()
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y)
    if (isSelEdge) { ctx.strokeStyle = 'rgba(0,38,192,0.6)'; ctx.lineWidth = 2 / s }
    else if (isHovEdge) { ctx.strokeStyle = 'rgba(0,38,192,0.35)'; ctx.lineWidth = 1.5 / s }
    else if (dim(edge.source) || dim(edge.target)) { ctx.strokeStyle = 'rgba(200,200,200,0.12)'; ctx.lineWidth = 0.8 / s }
    else { ctx.strokeStyle = 'rgba(160,160,160,0.3)'; ctx.lineWidth = Math.min(edge.weight * 0.7 + 0.5, 2.5) / s }
    ctx.stroke()
   }
   for (const node of nodes) {
    const isHov = hov === node.id; const isSel = sel === node.id; const isDim = dim(node.id)
    const color = TYPE_COLORS[node.type] ?? '#888'
    const r = isSel ? node.r + 4 : isHov ? node.r + 2 : node.r
    ctx.globalAlpha = isDim ? 0.2 : 1
    if (isSel || isHov) { ctx.shadowColor = color; ctx.shadowBlur = (isSel ? 14 : 8) / s }
    ctx.beginPath(); ctx.arc(node.x, node.y, r, 0, Math.PI * 2)
    ctx.fillStyle = isSel ? color : isDim ? color + '44' : color + 'e0'
    ctx.fill()
    ctx.strokeStyle = '#fff'; ctx.lineWidth = (isSel ? 2.5 : 1.5) / s; ctx.stroke()
    ctx.shadowBlur = 0; ctx.globalAlpha = 1
   }
   ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
   ctx.textBaseline = 'alphabetic'
   for (const node of nodes) {
    const isHov = hov === node.id; const isSel = sel === node.id; const isDim = dim(node.id)
    if (isDim) continue
    if (!isSel && !isHov && node.count < 2 && nodes.length > 25) continue
    if (s < 0.4 && !isSel && !isHov) continue
    const label = node.name.length > 18 ? node.name.slice(0, 16) + '\u2026' : node.name
    const color = TYPE_COLORS[node.type] ?? '#888'
    ctx.font = `${isSel || isHov ? 600 : 500} 11px system-ui, sans-serif`
    const tw = ctx.measureText(label).width
    const sx = node.x * s + px; const sy = node.y * s + py
    const r = (isSel ? node.r + 4 : isHov ? node.r + 2 : node.r) * s
    const lx = Math.max(tw / 2 + 6, Math.min(w - tw / 2 - 6, sx))
    const ly = Math.max(14, sy - r - 5)
    ctx.textAlign = 'center'
    ctx.lineJoin = 'round'; ctx.lineWidth = 3
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    ctx.strokeText(label, lx, ly)
    ctx.fillStyle = isSel ? color : '#222'
    ctx.fillText(label, lx, ly)
   }

   requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
  return () => { alive = false }
 }, [syncCanvas])

 const hitTest = useCallback((e: React.MouseEvent<HTMLCanvasElement>): SimNode | null => {
  const canvas = canvasRef.current; if (!canvas) return null
  const rect = canvas.getBoundingClientRect()
  const mx = e.clientX - rect.left; const my = e.clientY - rect.top
  const { x: wx, y: wy } = toWorld(mx, my)
  const s = scaleRef.current
  let best: SimNode | null = null; let bestD = Infinity
  for (const n of nodesRef.current) {
   const dx = n.x - wx; const dy = n.y - wy
   const d = Math.sqrt(dx * dx + dy * dy)
   if (d <= n.r + 8 / s && d < bestD) { best = n; bestD = d }
  }
  return best
 }, [toWorld])
 const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
  const node = hitTest(e)
  if (node) {
   dragRef.current = { type: 'node', id: node.id, ox: node.x, oy: node.y }
  } else {
   dragRef.current = {
    type: 'pan', sx: e.clientX, sy: e.clientY,
    px: panRef.current.x, py: panRef.current.y,
   }
  }
 }, [hitTest])
 const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
  const drag = dragRef.current
  if (drag?.type === 'node') {
   const node = nodesRef.current.find(n => n.id === drag.id)
   if (node) {
    const canvas = canvasRef.current; if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left; const my = e.clientY - rect.top
    const { x: wx, y: wy } = toWorld(mx, my)
    node.x = wx; node.y = wy; node.vx = 0; node.vy = 0
    node.pinned = true
    alphaRef.current = Math.max(alphaRef.current, 0.15)
   }
  } else if (drag?.type === 'pan') {
   panRef.current = {
    x: drag.px + (e.clientX - drag.sx),
    y: drag.py + (e.clientY - drag.sy),
   }
  } else {
   const node = hitTest(e)
   hoveredRef.current = node?.id ?? null
   setHoveredName(node?.name ?? null)
  }
 }, [hitTest, toWorld])
 const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
  const drag = dragRef.current
  if (drag?.type === 'node') {
   const id = drag.id
   setTimeout(() => {
    const node = nodesRef.current.find(n => n.id === id)
    if (node) node.pinned = false
   }, 600)
  }
  if (drag?.type !== 'pan' || (Math.abs(e.clientX - drag.sx) < 4 && Math.abs(e.clientY - drag.sy) < 4)) {
   const node = hitTest(e)
   if (node) {
    const isSame = selectedRef.current === node.id
    selectedRef.current = isSame ? null : node.id
    clusterRef.current = null; setClusterActive(false)
    setSelected(isSame ? null : node)
   } else if (!drag || drag.type === 'pan') {
    selectedRef.current = null; clusterRef.current = null
    setClusterActive(false); setSelected(null)
   }
  }
  dragRef.current = null
 }, [hitTest])
 const handleDblClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
  const node = hitTest(e)
  if (!node) return
  selectedRef.current = node.id; setSelected(node)
  const edges = edgesRef.current
  const nodeMap = new Map(nodesRef.current.map(n => [n.id, n]))
  const visited = new Set<string>([node.id]); const queue = [node.id]
  while (queue.length) {
   const cur = queue.shift()!
   for (const edge of edges) {
    const nb = edge.source === cur ? edge.target : edge.target === cur ? edge.source : null
    if (nb && !visited.has(nb) && nodeMap.has(nb)) { visited.add(nb); queue.push(nb) }
   }
  }
  clusterRef.current = visited; setClusterActive(true)
  fitView(visited)
 }, [hitTest, fitView])
 const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
  e.preventDefault()
  const rect = (e.target as HTMLCanvasElement).getBoundingClientRect()
  const mx = e.clientX - rect.left; const my = e.clientY - rect.top
  const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
  const newScale = Math.max(0.15, Math.min(4, scaleRef.current * factor))
  panRef.current = {
   x: mx - (mx - panRef.current.x) * (newScale / scaleRef.current),
   y: my - (my - panRef.current.y) * (newScale / scaleRef.current),
  }
  scaleRef.current = newScale
 }, [])
 const toggleType = (type: string) => {
  setActiveTypes(prev => {
   const next = new Set(prev)
   if (next.has(type)) { if (next.size > 1) next.delete(type) } else next.add(type)
   return next
  })
 }
 const selectCluster = useCallback((root: SimNode) => {
  const edges = edgesRef.current
  const nodeMap = new Map(nodesRef.current.map(n => [n.id, n]))
  const visited = new Set<string>([root.id]); const queue = [root.id]
  while (queue.length) {
   const cur = queue.shift()!
   for (const edge of edges) {
    const nb = edge.source === cur ? edge.target : edge.target === cur ? edge.source : null
    if (nb && !visited.has(nb) && nodeMap.has(nb)) { visited.add(nb); queue.push(nb) }
   }
  }
  clusterRef.current = visited; setClusterActive(true)
  fitView(visited)
 }, [fitView])
 const connectedNodes = selected ? edgesRef.current
  .filter(e => e.source === selected.id || e.target === selected.id)
  .map(e => {
   const otherId = e.source === selected.id ? e.target : e.source
   const other = nodesRef.current.find(n => n.id === otherId)
   return other ? { name: other.name, type: other.type, weight: e.weight } : null
  })
  .filter(Boolean).sort((a, b) => b!.weight - a!.weight) as { name: string; type: string; weight: number }[]
  : []

 const nodeCount = rawData ? rawData.nodes.filter(n => activeTypes.has(n.type)).length : 0

 if (loading) return (
  <div className="flex items-center justify-center h-full">
   <Loader2 size={20} className="animate-spin text-[var(--text-muted)]" />
  </div>
 )

 return (
  <div className="flex flex-col h-full">
   <div className="shrink-0 pb-3 flex items-center justify-between gap-4">
    <div>
     <h1 className="text-lg font-semibold text-[var(--text-bright)]">Entity Network</h1>
     <p className="text-xs text-[var(--text-muted)] mt-0.5">
      {nodeCount} entities · drag nodes or background to reposition · scroll to zoom · double-click for cluster
     </p>
    </div>
    <div className="flex items-center gap-1.5 flex-wrap justify-end">
     {ALL_TYPES.map(type => (
      <button key={type} onClick={() => toggleType(type)}
       className={cn('h-6 px-2.5 rounded-[4px] text-[11px] font-medium border transition-all capitalize',
        activeTypes.has(type) ? 'border-transparent text-white' : 'border-[var(--border)] text-[var(--text-muted)]'
       )}
       style={activeTypes.has(type) ? { backgroundColor: TYPE_COLORS[type] } : {}}
      >{type}</button>
     ))}
     <button onClick={() => fitView()} title="Fit all nodes in view"
      className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-body)] hover:bg-[var(--surface-2)] transition-colors">
      <Maximize2 size={12} />
     </button>
     <button onClick={load}
      className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-body)] hover:bg-[var(--surface-2)] transition-colors">
      <RefreshCw size={12} />
     </button>
    </div>
   </div>
   <div className="flex-1 min-h-0 flex gap-3">
    <div ref={containerRef} className="flex-1 min-w-0 border border-[var(--border)] rounded-[10px] overflow-hidden bg-[var(--surface)] relative">
     {nodeCount === 0 ? (
      <div className="flex items-center justify-center h-full text-sm text-[var(--text-muted)]">
       No entities yet — upload and analyse documents first.
      </div>
     ) : (
      <>
       <canvas ref={canvasRef} className="block w-full h-full"
        style={{ cursor: hoveredName ? 'pointer' : dragRef.current?.type === 'pan' ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { hoveredRef.current = null; setHoveredName(null); dragRef.current = null }}
        onDoubleClick={handleDblClick}
        onWheel={handleWheel}
       />
       {hoveredName && !selected && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-[var(--ink)] text-[var(--ink-contrast)] text-xs font-medium px-3 py-1.5 rounded-[4px] pointer-events-none shadow-lg whitespace-nowrap">
         {hoveredName}
        </div>
       )}
      </>
     )}
    </div>
    <NetworkSidePanel
     selected={selected}
     clusterActive={clusterActive}
     clusterSize={clusterRef.current?.size ?? 0}
     connectedNodes={connectedNodes}
     onClose={() => { selectedRef.current = null; clusterRef.current = null; setClusterActive(false); setSelected(null) }}
     onToggleCluster={() => {
      if (clusterActive) { clusterRef.current = null; setClusterActive(false) }
      else if (selected) selectCluster(selected)
     }}
     onSelectNode={(name) => {
      const node = nodesRef.current.find(n => n.name === name)
      if (node) { selectedRef.current = node.id; clusterRef.current = null; setClusterActive(false); setSelected(node) }
     }}
    />
   </div>
  </div>
 )
}
