// ── Shared AI types ─────────────────────────────────────────────────────────

export interface Message { role: 'user' | 'assistant'; content: string }
export interface ChatResult { content: string; noteSaved?: { title: string; folder: string } }
