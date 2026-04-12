import type { NetworkNode, NetworkEdge } from '@/app/api/entities/network/route'
import { REPULSION, ATTRACTION, GRAVITY, VEL_DECAY } from './network-config'
import type { SimNode } from './network-config'

export function initNodes(nodes: NetworkNode[]): SimNode[] {
 const count = Math.max(nodes.length, 1)
 return nodes.map((n, i) => {
 const angle = (i / count) * Math.PI * 2
 const ring = 80 + (i % 4) * 30
 return {
 ...n,
 x: Math.cos(angle) * ring + (Math.random() - 0.5) * 20,
 y: Math.sin(angle) * ring + (Math.random() - 0.5) * 20,
 vx: 0, vy: 0,
 r: 8 + Math.min(n.count * 2, 14),
 }
 })
}

export function tick(nodes: SimNode[], edges: NetworkEdge[], alpha: number) {
 for (let i = 0; i < nodes.length; i++) {
 for (let j = i + 1; j < nodes.length; j++) {
 const dx = nodes[j].x - nodes[i].x
 const dy = nodes[j].y - nodes[i].y
 const d2 = dx * dx + dy * dy + 1
 const f = (REPULSION * alpha) / d2
 if (!nodes[i].pinned) { nodes[i].vx -= f * dx; nodes[i].vy -= f * dy }
 if (!nodes[j].pinned) { nodes[j].vx += f * dx; nodes[j].vy += f * dy }
 }
 }
 for (const e of edges) {
 const a = nodes.find(n => n.id === e.source)
 const b = nodes.find(n => n.id === e.target)
 if (!a || !b) continue
 const dx = b.x - a.x; const dy = b.y - a.y
 const d = Math.sqrt(dx * dx + dy * dy) + 0.01
 const f = (d - 100 - e.weight * 8) * ATTRACTION
 const fx = (dx / d) * f; const fy = (dy / d) * f
 if (!a.pinned) { a.vx += fx; a.vy += fy }
 if (!b.pinned) { b.vx -= fx; b.vy -= fy }
 }
 for (const n of nodes) {
 if (n.pinned) continue
 n.vx += -n.x * GRAVITY * alpha
 n.vy += -n.y * GRAVITY * alpha
 n.vx *= VEL_DECAY; n.vy *= VEL_DECAY
 n.x += n.vx; n.y += n.vy
 }
}
