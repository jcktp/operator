import type { NetworkNode } from '@/app/api/entities/network/route'

// ── Palette ───────────────────────────────────────────────────────────────────

export const TYPE_COLORS: Record<string, string> = {
 person: '#6366f1',
 organisation: '#f59e0b',
 location: '#34d399',
 date: '#94a3b8',
 financial: '#f87171',
}
export const TYPE_LABELS: Record<string, string> = {
 person: 'Person', organisation: 'Organisation', location: 'Location',
 date: 'Date', financial: 'Financial',
}
export const ALL_TYPES = ['person', 'organisation', 'location', 'financial', 'date']

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SimNode extends NetworkNode {
 x: number; y: number; vx: number; vy: number; r: number; pinned?: boolean
}
