'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Loader2, RefreshCw, X, ExternalLink, Maximize2 } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { NetworkData, NetworkNode, NetworkEdge } from '@/app/api/entities/network/route'

// ── Palette ───────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  person:       '#0026c0',
  organisation: '#d97706',
  location:     '#059669',
  date:         '#64748b',
  financial:    '#dc2626',
}
const TYPE_LABELS: Record<string, string> = {
  person: 'Person', organisation: 'Organisation', location: 'Location',
  date: 'Date', financial: 'Financial',
}
const ALL_TYPES = ['person', 'organisation', 'location', 'financial', 'date']

// ── Simulation (world coords, origin = 0,0) ───────────────────────────────────

const REPULSION   = 900
const ATTRACTION  = 0.04
const GRAVITY     = 0.06
const VEL_DECAY   = 0.7
const ALPHA_START = 0.8
const ALPHA_DECAY = 0.005

interface SimNode extends NetworkNode {
  x: number; y: number; vx: number; vy: number; r: number; pinned?: boolean
}

function initNodes(nodes: NetworkNode[]): SimNode[] {
  const count = Math.max(nodes.length, 1)
  return nodes.map((n, i) => {
    const angle = (i / count) * Math.PI * 2
    const ring  = 80 + (i % 4) * 30
    return {
      ...n,
      x:  Math.cos(angle) * ring + (Math.random() - 0.5) * 20,
      y:  Math.sin(angle) * ring + (Math.random() - 0.5) * 20,
      vx: 0, vy: 0,
      r:  8 + Math.min(n.count * 2, 14),
    }
  })
}

function tick(nodes: SimNode[], edges: NetworkEdge[], alpha: number) {
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[j].x - nodes[i].x
      const dy = nodes[j].y - nodes[i].y
      const d2 = dx * dx + dy * dy + 1
      const f  = (REPULSION * alpha) / d2
      if (!nodes[i].pinned) { nodes[i].vx -= f * dx; nodes[i].vy -= f * dy }
      if (!nodes[j].pinned) { nodes[j].vx += f * dx; nodes[j].vy += f * dy }
    }
  }
  for (const e of edges) {
    const a = nodes.find(n => n.id === e.source)
    const b = nodes.find(n => n.id === e.target)
    if (!a || !b) continue
    const dx = b.x - a.x; const dy = b.y - a.y
    const d  = Math.sqrt(dx * dx + dy * dy) + 0.01
    const f  = (d - 100 - e.weight * 8) * ATTRACTION
    const fx = (dx / d) * f; const fy = (dy / d) * f
    if (!a.pinned) { a.vx += fx; a.vy += fy }
    if (!b.pinned) { b.vx -= fx; b.vy -= fy }
  }
  for (const n of nodes) {
    if (n.pinned) continue
    n.vx += -n.x * GRAVITY * alpha
    n.vy += -n.y * GRAVITY * alpha
    n.vx *= VEL_DECAY; n.vy *= VEL_DECAY
    n.x  += n.vx; n.y  += n.vy
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NetworkClient() {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const nodesRef     = useRef<SimNode[]>([])
  const edgesRef     = useRef<NetworkEdge[]>([])
  const alphaRef     = useRef(0)
  const cssSizeRef   = useRef({ w: 0, h: 0 })

  // Pan/zoom (in CSS-pixel units)
  const panRef       = useRef({ x: 0, y: 0 })
  const scaleRef     = useRef(1)

  // Interaction
  const hoveredRef   = useRef<string | null>(null)
  const selectedRef  = useRef<string | null>(null)
  const clusterRef   = useRef<Set<string> | null>(null)
  const dragRef      = useRef<{ type: 'node'; id: string; ox: number; oy: number } | { type: 'pan'; sx: number; sy: number; px: number; py: number } | null>(null)

  const [rawData, setRawData]         = useState<NetworkData | null>(null)
  const [loading, setLoading]         = useState(true)
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set(ALL_TYPES))
  const [hoveredName, setHoveredName] = useState<string | null>(null)
  const [selected, setSelected]       = useState<SimNode | null>(null)
  const [clusterActive, setClusterActive] = useState(false)

  // ── Canvas helpers ─────────────────────────────────────────────────────────

  const syncCanvas = useCallback(() => {
    const canvas = canvasRef.current; const el = containerRef.current
    if (!canvas || !el) return
    const w = el.clientWidth; const h = el.clientHeight
    const dpr = window.devicePixelRatio ?? 1
    const pw = Math.round(w * dpr); const ph = Math.round(h * dpr)
    if (canvas.width !== pw || canvas.height !== ph) {
      // On first resize: centre the pan so world-origin maps to canvas centre
      if (cssSizeRef.current.w === 0) {
        panRef.current = { x: w / 2, y: h / 2 }
      }
      canvas.width = pw; canvas.height = ph
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`
      cssSizeRef.current = { w, h }
    }
  }, [])

  // Screen (CSS) → world
  const toWorld = useCallback((sx: number, sy: number) => {
    const { x: px, y: py } = panRef.current; const s = scaleRef.current
    return { x: (sx - px) / s, y: (sy - py) / s }
  }, [])

  // ── Data loading ───────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/entities/network?limit=80&minCount=1')
      if (res.ok) setRawData(await res.json() as NetworkData)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  // ── Build/restart sim ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!rawData) return
    const nodes = rawData.nodes.filter(n => activeTypes.has(n.type))
    const ids   = new Set(nodes.map(n => n.id))
    const edges = rawData.edges.filter(e => ids.has(e.source) && ids.has(e.target))
    nodesRef.current  = initNodes(nodes)
    edgesRef.current  = edges
    alphaRef.current  = ALPHA_START
    hoveredRef.current  = null
    selectedRef.current = null
    clusterRef.current  = null
    dragRef.current     = null
    setSelected(null); setClusterActive(false)
  }, [rawData, activeTypes])

  // ── Fit view ───────────────────────────────────────────────────────────────

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
    const s  = Math.min(1.6, Math.min(w / bw, h / bh))
    const cx = (minX + maxX) / 2; const cy = (minY + maxY) / 2
    scaleRef.current = s
    panRef.current   = { x: w / 2 - cx * s, y: h / 2 - cy * s }
  }, [])

  // ── Animation loop ─────────────────────────────────────────────────────────

  useEffect(() => {
    let alive = true
    const frame = () => {
      if (!alive) return
      syncCanvas()
      const canvas = canvasRef.current
      if (!canvas) { requestAnimationFrame(frame); return }
      const ctx = canvas.getContext('2d')
      if (!ctx) { requestAnimationFrame(frame); return }

      const { w, h } = cssSizeRef.current
      const dpr      = window.devicePixelRatio ?? 1
      const nodes    = nodesRef.current
      const edges    = edgesRef.current
      let   alpha    = alphaRef.current

      if (alpha > 0.001 && nodes.length > 0) {
        tick(nodes, edges, alpha)
        alpha = Math.max(0, alpha - ALPHA_DECAY)
        alphaRef.current = alpha
      }

      // Clear
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      if (nodes.length === 0) { requestAnimationFrame(frame); return }

      const { x: px, y: py } = panRef.current
      const s   = scaleRef.current
      const hov = hoveredRef.current
      const sel = selectedRef.current
      const cluster = clusterRef.current

      const connectedToSel = sel
        ? new Set(edges.flatMap(e => e.source === sel ? [e.target] : e.target === sel ? [e.source] : []))
        : null

      const dim = (id: string) => {
        if (cluster) return !cluster.has(id)
        return !!sel && id !== sel && !connectedToSel?.has(id)
      }

      // Set world→canvas transform (pan + zoom + DPR)
      ctx.setTransform(dpr * s, 0, 0, dpr * s, px * dpr, py * dpr)

      // Edges
      for (const edge of edges) {
        const a = nodes.find(n => n.id === edge.source)
        const b = nodes.find(n => n.id === edge.target)
        if (!a || !b) continue
        const isSelEdge = sel && (edge.source === sel || edge.target === sel)
        const isHovEdge = !sel && (hov === edge.source || hov === edge.target)
        ctx.beginPath()
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y)
        if (isSelEdge)       { ctx.strokeStyle = 'rgba(0,38,192,0.6)';  ctx.lineWidth = 2 / s }
        else if (isHovEdge)  { ctx.strokeStyle = 'rgba(0,38,192,0.35)'; ctx.lineWidth = 1.5 / s }
        else if (dim(edge.source) || dim(edge.target)) { ctx.strokeStyle = 'rgba(200,200,200,0.12)'; ctx.lineWidth = 0.8 / s }
        else { ctx.strokeStyle = 'rgba(160,160,160,0.3)'; ctx.lineWidth = Math.min(edge.weight * 0.7 + 0.5, 2.5) / s }
        ctx.stroke()
      }

      // Nodes
      for (const node of nodes) {
        const isHov = hov === node.id; const isSel = sel === node.id; const isDim = dim(node.id)
        const color = TYPE_COLORS[node.type] ?? '#888'
        const r     = isSel ? node.r + 4 : isHov ? node.r + 2 : node.r
        ctx.globalAlpha = isDim ? 0.2 : 1
        if (isSel || isHov) { ctx.shadowColor = color; ctx.shadowBlur = (isSel ? 14 : 8) / s }
        ctx.beginPath(); ctx.arc(node.x, node.y, r, 0, Math.PI * 2)
        ctx.fillStyle = isSel ? color : isDim ? color + '44' : color + 'e0'
        ctx.fill()
        ctx.strokeStyle = '#fff'; ctx.lineWidth = (isSel ? 2.5 : 1.5) / s; ctx.stroke()
        ctx.shadowBlur = 0; ctx.globalAlpha = 1
      }

      // Labels — drawn in screen space so they stay 11px regardless of zoom
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.textBaseline = 'alphabetic'
      for (const node of nodes) {
        const isHov = hov === node.id; const isSel = sel === node.id; const isDim = dim(node.id)
        if (isDim) continue
        if (!isSel && !isHov && node.count < 2 && nodes.length > 25) continue
        if (s < 0.4 && !isSel && !isHov) continue
        const label = node.name.length > 18 ? node.name.slice(0, 16) + '…' : node.name
        const color = TYPE_COLORS[node.type] ?? '#888'
        ctx.font    = `${isSel || isHov ? 600 : 500} 11px system-ui, sans-serif`
        const tw    = ctx.measureText(label).width
        // Convert world → screen for label position
        const sx    = node.x * s + px; const sy = node.y * s + py
        const r     = (isSel ? node.r + 4 : isHov ? node.r + 2 : node.r) * s
        const lx    = Math.max(tw / 2 + 6, Math.min(w - tw / 2 - 6, sx))
        const ly    = Math.max(14, sy - r - 5)
        ctx.textAlign = 'center'
        ctx.lineJoin  = 'round'; ctx.lineWidth = 3
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

  // ── Mouse helpers ──────────────────────────────────────────────────────────

  const hitTest = useCallback((e: React.MouseEvent<HTMLCanvasElement>): SimNode | null => {
    const canvas = canvasRef.current; if (!canvas) return null
    const rect  = canvas.getBoundingClientRect()
    const mx    = e.clientX - rect.left; const my = e.clientY - rect.top
    const { x: wx, y: wy } = toWorld(mx, my)
    const s = scaleRef.current
    let best: SimNode | null = null; let bestD = Infinity
    for (const n of nodesRef.current) {
      const dx = n.x - wx; const dy = n.y - wy
      const d  = Math.sqrt(dx * dx + dy * dy)
      // hit radius slightly larger in world units accounting for zoom
      if (d <= n.r + 8 / s && d < bestD) { best = n; bestD = d }
    }
    return best
  }, [toWorld])

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const node = hitTest(e)
    if (node) {
      dragRef.current = { type: 'node', id: node.id, ox: node.x, oy: node.y }
    } else {
      const rect = (e.target as HTMLCanvasElement).getBoundingClientRect()
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
      // unpin after 500 ms so sim can resume but remembers position
      const id = drag.id
      setTimeout(() => {
        const node = nodesRef.current.find(n => n.id === id)
        if (node) node.pinned = false
      }, 600)
    }
    if (drag?.type !== 'pan' || (Math.abs(e.clientX - drag.sx) < 4 && Math.abs(e.clientY - drag.sy) < 4)) {
      // treat as click if barely moved
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
    // BFS cluster
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
    // zoom around cursor
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
      const other   = nodesRef.current.find(n => n.id === otherId)
      return other ? { name: other.name, type: other.type, weight: e.weight } : null
    })
    .filter(Boolean).sort((a, b) => b!.weight - a!.weight) as { name: string; type: string; weight: number }[]
  : []

  const nodeCount = rawData ? rawData.nodes.filter(n => activeTypes.has(n.type)).length : 0

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 size={20} className="animate-spin text-gray-400" />
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 pb-3 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-zinc-50">Entity Network</h1>
          <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
            {nodeCount} entities · drag nodes or background to reposition · scroll to zoom · double-click for cluster
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {ALL_TYPES.map(type => (
            <button key={type} onClick={() => toggleType(type)}
              className={cn('px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all capitalize',
                activeTypes.has(type) ? 'border-transparent text-white' : 'border-gray-200 dark:border-zinc-700 text-gray-400 dark:text-zinc-500'
              )}
              style={activeTypes.has(type) ? { backgroundColor: TYPE_COLORS[type] } : {}}
            >{type}</button>
          ))}
          <button onClick={() => fitView()} title="Fit all nodes in view"
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors">
            <Maximize2 size={12} />
          </button>
          <button onClick={load}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors">
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 flex gap-3">

        {/* Canvas */}
        <div ref={containerRef} className="flex-1 min-w-0 border border-gray-200 dark:border-zinc-700 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 relative">
          {nodeCount === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-gray-400 dark:text-zinc-500">
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
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium px-3 py-1.5 rounded-full pointer-events-none shadow-lg whitespace-nowrap">
                  {hoveredName}
                </div>
              )}
            </>
          )}
        </div>

        {/* Side panel */}
        <div className={cn(
          'shrink-0 border border-gray-200 dark:border-zinc-700 rounded-xl overflow-hidden transition-all duration-200',
          selected ? 'w-56' : 'w-44'
        )}>
          {selected ? (
            <div className="p-4 h-full overflow-y-auto space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-gray-900 dark:text-zinc-50 leading-tight">{selected.name}</p>
                  <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
                    style={{ backgroundColor: TYPE_COLORS[selected.type] ?? '#888' }}>
                    {TYPE_LABELS[selected.type] ?? selected.type}
                  </span>
                </div>
                <button onClick={() => { selectedRef.current = null; clusterRef.current = null; setClusterActive(false); setSelected(null) }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 shrink-0">
                  <X size={13} />
                </button>
              </div>

              <div className="text-xs text-gray-500 dark:text-zinc-400">
                Appears in <span className="font-semibold text-gray-800 dark:text-zinc-100">{selected.count}</span> document{selected.count !== 1 ? 's' : ''}
              </div>

              <button
                onClick={() => {
                  if (clusterActive) { clusterRef.current = null; setClusterActive(false) }
                  else selectCluster(selected)
                }}
                className={cn(
                  'w-full text-left text-[11px] px-2.5 py-1.5 rounded-lg border transition-colors font-medium',
                  clusterActive
                    ? 'border-[#0026c0] text-[#0026c0] bg-indigo-50 dark:bg-indigo-950 dark:text-indigo-400 dark:border-indigo-700'
                    : 'border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:border-gray-300'
                )}
              >
                {clusterActive
                  ? `Cluster (${clusterRef.current?.size ?? 0} nodes) — clear`
                  : 'Select full cluster'}
              </button>

              {connectedNodes.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide">Direct connections</p>
                  {connectedNodes.slice(0, 12).map(cn_ => (
                    <button key={cn_.name}
                      onClick={() => {
                        const node = nodesRef.current.find(n => n.name === cn_.name)
                        if (node) { selectedRef.current = node.id; clusterRef.current = null; setClusterActive(false); setSelected(node) }
                      }}
                      className="flex items-center justify-between w-full text-left gap-1.5 group">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: TYPE_COLORS[cn_.type] ?? '#888' }} />
                      <span className="flex-1 text-[11px] text-gray-700 dark:text-zinc-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{cn_.name}</span>
                      <span className="text-[10px] text-gray-300 dark:text-zinc-600 shrink-0">{cn_.weight}</span>
                    </button>
                  ))}
                </div>
              )}

              <Link href={`/entities/graph?name=${encodeURIComponent(selected.name)}`}
                className="flex items-center gap-1.5 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline pt-1">
                <ExternalLink size={10} /> Full entity view
              </Link>
            </div>
          ) : (
            <div className="p-4 h-full flex flex-col gap-4 text-[11px] text-gray-400 dark:text-zinc-500">
              <div>
                <p className="font-semibold text-gray-600 dark:text-zinc-300 mb-2 text-xs">Controls</p>
                <ul className="space-y-2 leading-relaxed">
                  <li><span className="font-medium text-gray-500 dark:text-zinc-400">Drag</span> background to pan</li>
                  <li><span className="font-medium text-gray-500 dark:text-zinc-400">Drag</span> a node to reposition it</li>
                  <li><span className="font-medium text-gray-500 dark:text-zinc-400">Scroll</span> to zoom</li>
                  <li><span className="font-medium text-gray-500 dark:text-zinc-400">Click</span> to inspect</li>
                  <li><span className="font-medium text-gray-500 dark:text-zinc-400">Dbl-click</span> to highlight cluster &amp; fit view</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-gray-500 dark:text-zinc-400 mb-1.5">Legend</p>
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
      </div>
    </div>
  )
}
