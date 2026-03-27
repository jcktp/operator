'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { GraphData, GraphNode, GraphEdge } from '@/app/api/entities/graph/route'

const TYPE_COLORS: Record<string, string> = {
  person: '#6366f1',
  organisation: '#f59e0b',
  location: '#10b981',
  date: '#64748b',
  financial: '#ef4444',
}

const TYPE_BORDER: Record<string, string> = {
  person: '#4f46e5',
  organisation: '#d97706',
  location: '#059669',
  date: '#475569',
  financial: '#dc2626',
}

interface SimNode extends GraphNode {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
}

function buildSim(data: GraphData, width: number, height: number): { nodes: SimNode[]; edges: GraphEdge[] } {
  const cx = width / 2
  const cy = height / 2

  const nodes: SimNode[] = data.nodes.map((n, i) => {
    const isCentre = n.id === data.centre
    const angle = (i / Math.max(data.nodes.length - 1, 1)) * Math.PI * 2
    const r = isCentre ? 20 : 10 + Math.min(n.count * 2, 10)
    return {
      ...n,
      x: isCentre ? cx : cx + Math.cos(angle) * 160,
      y: isCentre ? cy : cy + Math.sin(angle) * 160,
      vx: 0,
      vy: 0,
      radius: r,
    }
  })

  return { nodes, edges: data.edges }
}

const ALPHA_DECAY = 0.015
const VELOCITY_DECAY = 0.4
const REPULSION = 3000
const ATTRACTION = 0.04
const CENTRE_GRAVITY = 0.02

export default function EntityGraph({ initialData }: { initialData: GraphData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const simRef = useRef<{ nodes: SimNode[]; edges: GraphEdge[] } | null>(null)
  const alphaRef = useRef(1)
  const rafRef = useRef<number>(0)
  const router = useRouter()
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const hoveredRef = useRef<string | null>(null)
  const [data, setData] = useState<GraphData>(initialData)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const getSize = useCallback(() => {
    const el = containerRef.current
    if (!el) return { width: 700, height: 500 }
    return { width: el.clientWidth, height: el.clientHeight }
  }, [])

  const startSim = useCallback((graphData: GraphData) => {
    const { width, height } = getSize()
    simRef.current = buildSim(graphData, width, height)
    alphaRef.current = 1
  }, [getSize])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const sim = simRef.current
    if (!canvas || !sim) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height } = getSize()
    canvas.width = width
    canvas.height = height

    ctx.clearRect(0, 0, width, height)

    const alpha = alphaRef.current

    // Simulate one tick
    if (alpha > 0.001) {
      const nodes = sim.nodes
      const cx = width / 2
      const cy = height / 2

      // Repulsion between all pairs
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x
          const dy = nodes[j].y - nodes[i].y
          const dist2 = dx * dx + dy * dy + 1
          const force = (REPULSION * alpha) / dist2
          nodes[i].vx -= force * dx
          nodes[i].vy -= force * dy
          nodes[j].vx += force * dx
          nodes[j].vy += force * dy
        }
      }

      // Attraction along edges
      for (const edge of sim.edges) {
        const src = nodes.find(n => n.id === edge.source)
        const tgt = nodes.find(n => n.id === edge.target)
        if (!src || !tgt) continue
        const dx = tgt.x - src.x
        const dy = tgt.y - src.y
        const dist = Math.sqrt(dx * dx + dy * dy) + 0.01
        const targetDist = 80 + edge.weight * 10
        const diff = (dist - targetDist) * ATTRACTION
        src.vx += (dx / dist) * diff
        src.vy += (dy / dist) * diff
        tgt.vx -= (dx / dist) * diff
        tgt.vy -= (dy / dist) * diff
      }

      // Centre gravity
      for (const node of nodes) {
        node.vx += (cx - node.x) * CENTRE_GRAVITY * alpha
        node.vy += (cy - node.y) * CENTRE_GRAVITY * alpha
      }

      // Integrate
      for (const node of nodes) {
        node.vx *= VELOCITY_DECAY
        node.vy *= VELOCITY_DECAY
        node.x += node.vx
        node.y += node.vy
        // Bound to canvas
        node.x = Math.max(node.radius + 2, Math.min(width - node.radius - 2, node.x))
        node.y = Math.max(node.radius + 2, Math.min(height - node.radius - 2, node.y))
      }

      alphaRef.current = Math.max(0, alphaRef.current - ALPHA_DECAY)
    }

    // Draw edges
    for (const edge of sim.edges) {
      const src = sim.nodes.find(n => n.id === edge.source)
      const tgt = sim.nodes.find(n => n.id === edge.target)
      if (!src || !tgt) continue
      ctx.beginPath()
      ctx.moveTo(src.x, src.y)
      ctx.lineTo(tgt.x, tgt.y)
      ctx.strokeStyle = hoveredRef.current === src.id || hoveredRef.current === tgt.id
        ? 'rgba(99,102,241,0.5)'
        : 'rgba(209,213,219,0.8)'
      ctx.lineWidth = Math.max(0.5, edge.weight * 0.5)
      ctx.stroke()
    }

    // Draw nodes
    for (const node of sim.nodes) {
      const isCentre = node.id === data.centre
      const isHovered = hoveredRef.current === node.id
      const fill = TYPE_COLORS[node.type] ?? '#94a3b8'
      const border = TYPE_BORDER[node.type] ?? '#64748b'

      ctx.beginPath()
      ctx.arc(node.x, node.y, node.radius + (isHovered ? 3 : 0), 0, Math.PI * 2)
      ctx.fillStyle = fill
      ctx.fill()
      ctx.strokeStyle = isCentre ? '#1e293b' : border
      ctx.lineWidth = isCentre ? 3 : 1.5
      ctx.stroke()

      // Label
      ctx.fillStyle = isHovered || isCentre ? '#111827' : '#374151'
      ctx.font = `${isCentre ? 600 : 400} ${isCentre ? 12 : 10}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(
        node.name.length > 18 ? node.name.slice(0, 17) + '…' : node.name,
        node.x,
        node.y + node.radius + 10
      )
    }

    rafRef.current = requestAnimationFrame(draw)
  }, [data.centre, getSize])

  useEffect(() => {
    startSim(data)
    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [data, startSim, draw])

  const getNodeAt = useCallback((cx: number, cy: number): SimNode | null => {
    const sim = simRef.current
    if (!sim) return null
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const x = cx - rect.left
    const y = cy - rect.top
    for (const node of sim.nodes) {
      const dx = node.x - x
      const dy = node.y - y
      if (Math.sqrt(dx * dx + dy * dy) <= node.radius + 6) return node
    }
    return null
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const node = getNodeAt(e.clientX, e.clientY)
    const id = node?.id ?? null
    hoveredRef.current = id
    setHoveredNode(id)
    if (canvasRef.current) {
      canvasRef.current.style.cursor = node ? 'pointer' : 'default'
    }
  }, [getNodeAt])

  const handleClick = useCallback(async (e: React.MouseEvent) => {
    const node = getNodeAt(e.clientX, e.clientY)
    if (!node) return
    if (node.id === data.centre) {
      // Navigate to entity search
      router.push(`/entities`)
      return
    }
    // Re-centre on this entity
    setLoading(true)
    try {
      const res = await fetch(`/api/entities/graph?name=${encodeURIComponent(node.id)}`)
      const newData: GraphData = await res.json()
      setData(newData)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [getNodeAt, data.centre, router])

  return (
    <div ref={containerRef} className="relative w-full h-full">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/60 z-10">
          <span className="text-sm text-gray-400">Loading…</span>
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { hoveredRef.current = null; setHoveredNode(null) }}
        onClick={handleClick}
      />
      {hoveredNode && hoveredNode !== data.centre && (
        <div className="absolute bottom-3 left-3 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-600 shadow pointer-events-none">
          Click to re-centre on <strong>{hoveredNode}</strong>
        </div>
      )}
      <div className="absolute top-3 right-3 flex flex-wrap gap-1.5 justify-end">
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <span key={type} className="flex items-center gap-1 text-xs text-gray-500 bg-white border border-gray-100 rounded px-2 py-0.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </span>
        ))}
      </div>
    </div>
  )
}
