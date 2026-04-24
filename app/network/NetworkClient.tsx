'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import cytoscape from 'cytoscape'
import type { Core, EventObject, NodeSingular, EdgeSingular, CollectionReturnValue } from 'cytoscape'
import { Loader2, RefreshCw, Maximize2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NetworkData } from '@/app/api/entities/network/route'
import { TYPE_COLORS, ALL_TYPES } from './network-config'
import type { SimNode } from './network-config'
import NetworkSidePanel from './NetworkSidePanel'

/** Build a SimNode-compatible object from a Cytoscape node for the side panel */
function toSimNode(node: NodeSingular): SimNode {
 const d = node.data()
 const pos = node.position()
 return {
  id: d.id,
  name: d.name,
  type: d.entityType,
  count: d.count,
  x: pos.x,
  y: pos.y,
  vx: 0,
  vy: 0,
  r: 8 + Math.min(d.count * 2, 14),
 }
}

export default function NetworkClient() {
 const containerRef = useRef<HTMLDivElement>(null)
 const cyRef = useRef<Core | null>(null)
 const [rawData, setRawData] = useState<NetworkData | null>(null)
 const [loading, setLoading] = useState(true)
 const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set(ALL_TYPES))
 const [selected, setSelected] = useState<SimNode | null>(null)
 const [clusterActive, setClusterActive] = useState(false)
 const [clusterIds, setClusterIds] = useState<Set<string>>(new Set())
 const [hoveredName, setHoveredName] = useState<string | null>(null)

 const load = useCallback(async () => {
  setLoading(true)
  try {
   const res = await fetch('/api/entities/network?limit=80&minCount=1')
   if (res.ok) setRawData(await res.json() as NetworkData)
  } catch { /* silent */ }
  finally { setLoading(false) }
 }, [])

 useEffect(() => { void load() }, [load])

 // Build and mount Cytoscape when data or filters change
 useEffect(() => {
  if (!rawData || !containerRef.current) return

  const nodes = rawData.nodes.filter(n => activeTypes.has(n.type))
  const ids = new Set(nodes.map(n => n.id))
  const edges = rawData.edges.filter(e => ids.has(e.source) && ids.has(e.target))

  if (nodes.length === 0) {
   if (cyRef.current) {
    const old = cyRef.current; cyRef.current = null
    old.unmount(); old.destroy()
   }
   return
  }

  // Destroy previous instance — delay so pending renderer callbacks drain
  if (cyRef.current) {
   const old = cyRef.current
   cyRef.current = null
   old.unmount()
   old.destroy()
  }

  const container = containerRef.current
  const cy = cytoscape({
   container,
   elements: [
    ...nodes.map(n => ({
     data: {
      id: n.id,
      name: n.name,
      entityType: n.type,
      count: n.count,
      nodeSize: 16 + Math.min(n.count * 4, 28),
     },
    })),
    ...edges.map((e, i) => ({
     data: {
      id: `e-${i}`,
      source: e.source,
      target: e.target,
      weight: e.weight,
     },
    })),
   ],
   style: [
    {
     selector: 'node',
     style: {
      'background-color': (ele: NodeSingular) => TYPE_COLORS[ele.data('entityType')] ?? '#888',
      'width': 'data(nodeSize)',
      'height': 'data(nodeSize)',
      'label': 'data(name)',
      'font-size': 10,
      'font-weight': 500,
      'font-family': 'system-ui, sans-serif',
      'text-valign': 'top',
      'text-halign': 'center',
      'text-margin-y': -6,
      'color': '#222',
      'text-outline-color': '#fff',
      'text-outline-width': 2,
      'text-max-width': '90px',
      'text-wrap': 'ellipsis',
      'border-width': 1.5,
      'border-color': '#fff',
      'overlay-opacity': 0,
      'transition-property': 'opacity, border-width, border-color, width, height',
      'transition-duration': 150,
     } as cytoscape.Css.Node,
    },
    {
     selector: 'node:selected',
     style: {
      'border-width': 3,
      'border-color': (ele: NodeSingular) => TYPE_COLORS[ele.data('entityType')] ?? '#888',
      'font-weight': 700,
      'color': (ele: NodeSingular) => TYPE_COLORS[ele.data('entityType')] ?? '#888',
      'width': (ele: NodeSingular) => (ele.data('nodeSize') as number) + 8,
      'height': (ele: NodeSingular) => (ele.data('nodeSize') as number) + 8,
     } as cytoscape.Css.Node,
    },
    {
     selector: 'edge',
     style: {
      'width': (ele: EdgeSingular) => Math.min((ele.data('weight') as number) * 0.7 + 0.5, 2.5),
      'line-color': 'rgba(160,160,160,0.35)',
      'curve-style': 'bezier',
      'overlay-opacity': 0,
      'transition-property': 'line-color, width, opacity',
      'transition-duration': 150,
     } as cytoscape.Css.Edge,
    },
    {
     selector: 'edge[?highlighted]',
     style: {
      'line-color': 'rgba(0,38,192,0.6)',
      'width': 2,
      'z-index': 1,
     } as cytoscape.Css.Edge,
    },
    {
     selector: 'node.dimmed',
     style: {
      'opacity': 0.15,
     } as cytoscape.Css.Node,
    },
    {
     selector: 'edge.dimmed',
     style: {
      'opacity': 0.08,
     } as cytoscape.Css.Edge,
    },
    {
     selector: 'node.hovered',
     style: {
      'border-width': 2.5,
      'border-color': (ele: NodeSingular) => TYPE_COLORS[ele.data('entityType')] ?? '#888',
      'width': (ele: NodeSingular) => (ele.data('nodeSize') as number) + 4,
      'height': (ele: NodeSingular) => (ele.data('nodeSize') as number) + 4,
     } as cytoscape.Css.Node,
    },
    {
     selector: 'node[count < 2]',
     style: {
      'font-size': 0,
     } as cytoscape.Css.Node,
    },
    {
     selector: 'node:selected[count < 2], node.hovered[count < 2]',
     style: {
      'font-size': 10,
     } as cytoscape.Css.Node,
    },
   ],
   layout: {
    name: 'cose',
    animate: true,
    animationDuration: 800,
    nodeRepulsion: () => 8000,
    idealEdgeLength: () => 120,
    gravity: 0.25,
    numIter: 300,
    nodeDimensionsIncludeLabels: true,
    randomize: true,
    fit: true,
    padding: 40,
   } as cytoscape.CoseLayoutOptions,
   minZoom: 0.15,
   maxZoom: 4,
   wheelSensitivity: 0.15,
   boxSelectionEnabled: false,
   selectionType: 'single',
  })

  cyRef.current = cy

  // ── Event handlers ────────────────────────────────────────

  cy.on('tap', 'node', (evt: EventObject) => {
   const node = evt.target as NodeSingular
   clearHighlights(cy)
   highlightSelection(cy, node)
   setSelected(toSimNode(node))
   setClusterActive(false)
   setClusterIds(new Set())
  })

  cy.on('tap', (evt: EventObject) => {
   if (evt.target === cy) {
    clearHighlights(cy)
    cy.elements().unselect()
    setSelected(null)
    setClusterActive(false)
    setClusterIds(new Set())
   }
  })

  cy.on('dbltap', 'node', (evt: EventObject) => {
   const node = evt.target as NodeSingular
   clearHighlights(cy)
   const cluster = getCluster(cy, node)
   highlightCluster(cy, cluster)
   setSelected(toSimNode(node))
   setClusterActive(true)
   const ids = new Set<string>(); cluster.forEach(n => { ids.add(n.id()) })
   setClusterIds(ids)
   cy.fit(cluster, 40)
  })

  cy.on('mouseover', 'node', (evt: EventObject) => {
   const node = evt.target as NodeSingular
   node.addClass('hovered')
   setHoveredName(node.data('name'))
   if (containerRef.current) containerRef.current.style.cursor = 'pointer'
  })

  cy.on('mouseout', 'node', (evt: EventObject) => {
   const node = evt.target as NodeSingular
   node.removeClass('hovered')
   setHoveredName(null)
   if (containerRef.current) containerRef.current.style.cursor = 'grab'
  })

  return () => {
   cyRef.current = null
   cy.unmount()
   cy.destroy()
  }
 }, [rawData, activeTypes])

 const fitView = useCallback((ids?: Set<string>) => {
  const cy = cyRef.current
  if (!cy) return
  if (ids && ids.size > 0) {
   const nodes = cy.nodes().filter(n => ids.has(n.id()))
   if (nodes.length > 0) cy.fit(nodes, 40)
  } else {
   cy.fit(undefined, 40)
  }
 }, [])

 const selectCluster = useCallback((root: SimNode) => {
  const cy = cyRef.current
  if (!cy) return
  const rootNode = cy.getElementById(root.id)
  if (rootNode.empty()) return
  clearHighlights(cy)
  const cluster = getCluster(cy, rootNode as NodeSingular)
  highlightCluster(cy, cluster)
  setClusterActive(true)
  const ids = new Set<string>(); cluster.forEach(n => { ids.add(n.id()) })
  setClusterIds(ids)
  cy.fit(cluster, 40)
 }, [])

 const toggleType = (type: string) => {
  setActiveTypes(prev => {
   const next = new Set(prev)
   if (next.has(type)) { if (next.size > 1) next.delete(type) } else next.add(type)
   return next
  })
 }

 // Compute connected nodes for the side panel
 const connectedNodes = selected && cyRef.current
  ? (() => {
   const cy = cyRef.current!
   const node = cy.getElementById(selected.id)
   if (node.empty()) return []
   return node.connectedEdges().map(edge => {
    const other = edge.source().id() === selected.id ? edge.target() : edge.source()
    return { name: other.data('name'), type: other.data('entityType'), weight: edge.data('weight') as number }
   }).sort((a, b) => b.weight - a.weight).slice(0, 12)
  })()
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
    <div
     ref={containerRef}
     className="flex-1 min-w-0 border border-[var(--border)] rounded-[10px] overflow-hidden bg-[var(--surface)] relative"
     style={{ cursor: 'grab' }}
    >
     {nodeCount === 0 && (
      <div className="flex items-center justify-center h-full text-sm text-[var(--text-muted)]">
       No entities yet — upload and analyse documents first.
      </div>
     )}
     {hoveredName && !selected && (
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-[var(--ink)] text-[var(--ink-contrast)] text-xs font-medium px-3 py-1.5 rounded-[4px] pointer-events-none shadow-lg whitespace-nowrap z-10">
       {hoveredName}
      </div>
     )}
    </div>
    <NetworkSidePanel
     selected={selected}
     clusterActive={clusterActive}
     clusterSize={clusterIds.size}
     connectedNodes={connectedNodes}
     onClose={() => {
      if (cyRef.current) { clearHighlights(cyRef.current); cyRef.current.elements().unselect() }
      setSelected(null); setClusterActive(false); setClusterIds(new Set())
     }}
     onToggleCluster={() => {
      if (clusterActive) {
       if (cyRef.current) clearHighlights(cyRef.current)
       setClusterActive(false); setClusterIds(new Set())
      } else if (selected) selectCluster(selected)
     }}
     onSelectNode={(name) => {
      const cy = cyRef.current
      if (!cy) return
      const matched = cy.nodes().filter(n => n.data('name') === name)
      if (matched.nonempty()) {
       const node = matched.first() as NodeSingular
       clearHighlights(cy)
       cy.elements().unselect()
       node.select()
       highlightSelection(cy, node)
       setSelected(toSimNode(node))
       setClusterActive(false); setClusterIds(new Set())
       cy.animate({ center: { eles: node }, duration: 300 })
      }
     }}
    />
   </div>
  </div>
 )
}

// ── Helper functions ────────────────────────────────────────

function clearHighlights(cy: Core) {
 cy.elements().removeClass('dimmed')
 cy.edges().removeData('highlighted')
}

function highlightSelection(cy: Core, node: NodeSingular) {
 const edges = node.connectedEdges()
 const neighbors = edges.connectedNodes()
 const neighborhood = edges.union(neighbors).union(node)
 cy.elements().not(neighborhood).addClass('dimmed')
 edges.data('highlighted', true)
}

function highlightCluster(cy: Core, cluster: CollectionReturnValue) {
 const clusterEdges = cluster.edgesWith(cluster)
 const neighborhood = cluster.union(clusterEdges)
 cy.elements().not(neighborhood).addClass('dimmed')
 clusterEdges.data('highlighted', true)
}

function getCluster(cy: Core, root: NodeSingular): CollectionReturnValue {
 const visited = new Set<string>([root.id()])
 const queue: NodeSingular[] = [root]
 let result = cy.collection().union(root)

 while (queue.length) {
  const cur = queue.shift()!
  const neighbors = cur.neighborhood().nodes()
  for (let i = 0; i < neighbors.length; i++) {
   const n = neighbors[i] as NodeSingular
   if (!visited.has(n.id())) {
    visited.add(n.id())
    queue.push(n)
    result = result.union(n)
   }
  }
 }

 return result
}
