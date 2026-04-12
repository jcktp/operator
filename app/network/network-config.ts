import type { NetworkNode } from '@/app/api/entities/network/route'

// ── Palette ───────────────────────────────────────────────────────────────────

export const TYPE_COLORS: Record<string, string> = {
 person: '#0026c0',
 organisation: '#d97706',
 location: '#059669',
 date: '#64748b',
 financial: '#dc2626',
}
export const TYPE_LABELS: Record<string, string> = {
 person: 'Person', organisation: 'Organisation', location: 'Location',
 date: 'Date', financial: 'Financial',
}
export const ALL_TYPES = ['person', 'organisation', 'location', 'financial', 'date']

// ── Simulation constants ──────────────────────────────────────────────────────

export const REPULSION = 900
export const ATTRACTION = 0.04
export const GRAVITY = 0.06
export const VEL_DECAY = 0.7
export const ALPHA_START = 0.8
export const ALPHA_DECAY = 0.005

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SimNode extends NetworkNode {
 x: number; y: number; vx: number; vy: number; r: number; pinned?: boolean
}
