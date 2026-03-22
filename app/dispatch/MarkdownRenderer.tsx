import { Download } from 'lucide-react'

// ── Inline renderer ──────────────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)
  return (
    <>
      {parts.map((p, i) => {
        if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={i}>{p.slice(2, -2)}</strong>
        if (/^\*[^*]+\*$/.test(p)) return <em key={i}>{p.slice(1, -1)}</em>
        if (/^`[^`]+`$/.test(p)) return <code key={i} className="bg-black/10 rounded px-0.5 text-[0.82em] font-mono">{p.slice(1, -1)}</code>
        return <span key={i}>{p}</span>
      })}
    </>
  )
}

// ── Block renderer ───────────────────────────────────────────────────────────

function renderInlineBlocks(text: string) {
  const lines = text.split('\n')
  return (
    <>
      {lines.map((line, i) => {
        if (/^#{1,3}\s/.test(line)) {
          const level = (line.match(/^#+/) ?? [''])[0].length
          const content = renderInline(line.replace(/^#+\s/, ''))
          const cls = level === 1 ? 'font-bold text-base mt-2' : level === 2 ? 'font-semibold mt-1.5' : 'font-semibold'
          return <div key={i} className={cls}>{content}</div>
        }
        if (/^[-*]\s/.test(line)) {
          return (
            <div key={i} className="flex gap-1.5 my-0.5">
              <span className="shrink-0 mt-[6px] w-1 h-1 bg-current rounded-full" />
              <span>{renderInline(line.replace(/^[-*]\s/, ''))}</span>
            </div>
          )
        }
        if (/^\d+\.\s/.test(line)) {
          const num = (line.match(/^\d+/) ?? ['1'])[0]
          return (
            <div key={i} className="flex gap-1.5 my-0.5">
              <span className="shrink-0 text-xs font-medium">{num}.</span>
              <span>{renderInline(line.replace(/^\d+\.\s/, ''))}</span>
            </div>
          )
        }
        if (line.trim() === '') return <div key={i} className="h-1.5" />
        return <p key={i} className="my-0.5">{renderInline(line)}</p>
      })}
    </>
  )
}

// ── Full markdown renderer ───────────────────────────────────────────────────

export function renderMarkdown(text: string, onDownload: (code: string, lang: string) => void) {
  const parts = text.split(/(```[\s\S]*?```)/g)
  return (
    <>
      {parts.map((part, i) => {
        const codeMatch = part.match(/^```(\w*)\n?([\s\S]*?)```$/)
        if (codeMatch) {
          const lang = codeMatch[1] || 'txt'
          const code = codeMatch[2]
          return (
            <div key={i} className="my-2 rounded-xl overflow-hidden border border-gray-200">
              <div className="flex items-center justify-between bg-gray-800 px-3 py-1.5">
                <span className="text-[10px] text-gray-400 font-mono">{lang}</span>
                <button
                  onClick={() => onDownload(code, lang)}
                  className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-white transition-colors"
                >
                  <Download size={10} /> Download
                </button>
              </div>
              <pre className="bg-gray-900 text-green-400 text-xs px-3 py-2 overflow-x-auto font-mono whitespace-pre">
                {code}
              </pre>
            </div>
          )
        }
        return <span key={i}>{renderInlineBlocks(part)}</span>
      })}
    </>
  )
}
