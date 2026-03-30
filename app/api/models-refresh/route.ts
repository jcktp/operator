import { NextResponse } from 'next/server'

// Curated list of small, quality models — checked periodically
// These are models from ollama.com/library that run well locally on consumer hardware
const CURATED_MODELS = [
  { id: 'phi4-mini',        label: 'Phi 4 Mini',         note: 'Recommended default — fast, high quality structured output',           tags: ['fast', 'quality'] },
  { id: 'qwen3:4b',          label: 'Qwen3 4B',            note: 'Strong instruction following and structured output', tags: ['quality', 'structured'] },
  { id: 'llama3.2:3b',      label: 'Llama 3.2 3B',       note: 'Fast and lightweight',                   tags: ['fast'] },
  { id: 'llama3.2:1b',      label: 'Llama 3.2 1B',       note: 'Fastest, lightest',                      tags: ['fast'] },
  { id: 'llama3.1:8b',      label: 'Llama 3.1 8B',       note: 'Excellent quality, needs ~6 GB RAM',     tags: ['quality'] },
  { id: 'qwen2.5:3b',       label: 'Qwen 2.5 3B',        note: 'Great at structured output',             tags: ['structured'] },
  { id: 'qwen2.5:7b',       label: 'Qwen 2.5 7B',        note: 'High quality structured output',        tags: ['quality', 'structured'] },
  { id: 'gemma2:2b',        label: 'Gemma 2 2B',         note: 'Small and capable',                     tags: ['fast'] },
  { id: 'gemma2:9b',        label: 'Gemma 2 9B',         note: 'Best quality Gemma, ~7 GB RAM',         tags: ['quality'] },
  { id: 'mistral:7b',       label: 'Mistral 7B',         note: 'Strong reasoning, needs ~5 GB RAM',     tags: ['quality'] },
  { id: 'phi3.5',           label: 'Phi 3.5',            note: 'Microsoft small model',                 tags: ['fast'] },
  { id: 'deepseek-r1:1.5b', label: 'DeepSeek R1 1.5B',  note: 'Reasoning model, very lightweight',     tags: ['reasoning'] },
  { id: 'deepseek-r1:7b',   label: 'DeepSeek R1 7B',    note: 'Strong reasoning, ~5 GB RAM',           tags: ['reasoning', 'quality'] },
  { id: 'smollm2:1.7b',     label: 'SmolLM2 1.7B',      note: 'Tiny but surprisingly capable',         tags: ['fast'] },
]

export async function GET() {
  return NextResponse.json({ models: CURATED_MODELS, updatedAt: new Date().toISOString() })
}
