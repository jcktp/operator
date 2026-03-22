'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Copy, Check } from 'lucide-react'

// ── Excel / CSV structured display ─────────────────────────────────────────

function SpreadsheetTable({ rows }: { rows: string[][] }) {
  if (rows.length === 0) return null
  const [header, ...data] = rows
  return (
    <div className="overflow-auto rounded border border-gray-200">
      <table className="min-w-full text-xs border-collapse">
        <thead>
          <tr>
            {header.map((h, i) => (
              <th
                key={i}
                className="text-left px-3 py-2 font-semibold text-gray-700 bg-gray-100 border border-gray-200 whitespace-nowrap sticky top-0"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              {row.map((cell, ci) => {
                const isNum = cell !== '' && !isNaN(Number(cell.replace(/[$,%]/g, '')))
                return (
                  <td
                    key={ci}
                    className={cn(
                      'px-3 py-1.5 border border-gray-100 whitespace-nowrap text-gray-700',
                      isNum && 'text-right font-mono'
                    )}
                  >
                    {cell}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ExcelDisplay({ json }: { json: string }) {
  const data = useMemo(() => {
    try { return JSON.parse(json) as { type: 'excel'; sheets: Array<{ name: string; rows: string[][] }> } }
    catch { return null }
  }, [json])

  const [activeSheet, setActiveSheet] = useState(0)
  if (!data) return <pre className="text-xs text-gray-500 whitespace-pre-wrap">{json}</pre>
  const { sheets } = data

  return (
    <div className="space-y-3">
      {sheets.length > 1 && (
        <div className="flex gap-1 flex-wrap">
          {sheets.map((s, i) => (
            <button
              key={i}
              onClick={() => setActiveSheet(i)}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-md border transition-colors',
                activeSheet === i
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      <SpreadsheetTable rows={sheets[activeSheet]?.rows ?? []} />
      <p className="text-xs text-gray-400 text-right">{(sheets[activeSheet]?.rows.length ?? 1) - 1} rows</p>
    </div>
  )
}

function CsvDisplay({ json }: { json: string }) {
  const rows = useMemo(() => {
    try { return (JSON.parse(json) as { type: 'csv'; rows: string[][] }).rows }
    catch { return null }
  }, [json])
  if (!rows) return <pre className="text-xs text-gray-500 whitespace-pre-wrap">{json}</pre>
  return (
    <div className="space-y-2">
      <SpreadsheetTable rows={rows} />
      <p className="text-xs text-gray-400 text-right">{rows.length - 1} rows</p>
    </div>
  )
}

// ── Word doc HTML display ───────────────────────────────────────────────────

function WordDisplay({ html }: { html: string }) {
  // mammoth output is trusted (from user's own uploaded files; no script tags generated)
  return <div className="doc-content" dangerouslySetInnerHTML={{ __html: html }} />
}

// ── Plain text display ──────────────────────────────────────────────────────

function isHeader(line: string): boolean {
  const t = line.trim()
  if (!t || t.length > 80) return false
  if (/^#{1,3}\s/.test(t)) return true
  if (/^[A-Z][A-Z\s\-\/&,]{4,}$/.test(t)) return true
  if (t.endsWith(':') && !t.includes('.') && t.length < 60) return true
  return false
}

function isBullet(line: string): boolean {
  return /^[-•*●]\s/.test(line.trim()) || /^\d+[\.\)]\s/.test(line.trim())
}

function TextDisplay({ content }: { content: string }) {
  const lines = content.split('\n')
  const nodes: React.ReactNode[] = []
  let paraBuffer: string[] = []
  let key = 0

  const flushPara = () => {
    if (!paraBuffer.length) return
    nodes.push(
      <p key={key++} className="text-sm text-gray-700 leading-relaxed">
        {paraBuffer.join(' ')}
      </p>
    )
    paraBuffer = []
  }

  for (const line of lines) {
    const t = line.trim()
    if (!t) { flushPara(); continue }

    if (isHeader(t)) {
      flushPara()
      nodes.push(
        <p key={key++} className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-5 mb-1 border-b border-gray-100 pb-1">
          {t.replace(/^#{1,3}\s/, '').replace(/:$/, '')}
        </p>
      )
      continue
    }

    if (isBullet(t)) {
      flushPara()
      nodes.push(
        <div key={key++} className="flex gap-2 text-sm text-gray-700 leading-relaxed">
          <span className="text-gray-300 shrink-0 mt-0.5">–</span>
          <span>{t.replace(/^[-•*●]\s/, '').replace(/^\d+[\.\)]\s/, '')}</span>
        </div>
      )
      continue
    }

    paraBuffer.push(t)
  }
  flushPara()

  return <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">{nodes}</div>
}

// ── Main component ──────────────────────────────────────────────────────────

type DisplayMode = 'formatted' | 'raw'

export default function RawContent({
  content,
  displayContent,
  fileType,
  reportId,
}: {
  content: string
  displayContent?: string
  fileType: string
  reportId?: string
}) {
  const [mode, setMode] = useState<DisplayMode>('formatted')
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const isExcel = ['xlsx', 'xls'].includes(fileType)
  const isCsv = fileType === 'csv'
  const isWord = ['docx', 'doc'].includes(fileType)
  const isPdf = fileType === 'pdf'
  const isImage = displayContent?.startsWith('image:') ?? false

  // Image: show the image + AI description, no raw/formatted toggle needed
  if (isImage) {
    return (
      <div className="space-y-3">
        <img
          src={`/api/reports/${reportId}/image`}
          alt="Uploaded image"
          className="w-full rounded-lg border border-gray-200 object-contain max-h-[600px]"
        />
        {content && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">AI Description</p>
            <TextDisplay content={content} />
          </div>
        )}
      </div>
    )
  }

  const renderFormatted = () => {
    // Excel/CSV: always from displayContent (structured JSON)
    if (isExcel && displayContent) return <ExcelDisplay json={displayContent} />
    if (isCsv && displayContent) return <CsvDisplay json={displayContent} />
    // Word: HTML from mammoth
    if (isWord && displayContent) return <WordDisplay html={displayContent} />
    // PDF / txt / md / fallback
    return <TextDisplay content={content} />
  }

  const formatLabel = isExcel ? 'XLSX' : isCsv ? 'CSV' : isWord ? 'DOCX' : isPdf ? 'PDF' : fileType.toUpperCase()

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode('formatted')}
            className={cn(
              'text-xs px-2.5 py-1 rounded-md font-medium transition-colors',
              mode === 'formatted' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {isWord ? 'Document' : isExcel || isCsv ? 'Spreadsheet' : 'Formatted'}
          </button>
          <button
            onClick={() => setMode('raw')}
            className={cn(
              'text-xs px-2.5 py-1 rounded-md font-medium transition-colors',
              mode === 'raw' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            Raw text
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 uppercase tracking-wide">{formatLabel}</span>
          <button onClick={copy} className="text-gray-400 hover:text-gray-600 transition-colors" title="Copy raw text">
            {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
          </button>
        </div>
      </div>

      {mode === 'raw'
        ? <pre className="text-xs text-gray-500 whitespace-pre-wrap leading-relaxed font-mono max-h-96 overflow-y-auto">{content}</pre>
        : renderFormatted()
      }
    </div>
  )
}
