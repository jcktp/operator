'use client'

import { useEditor, EditorContent, Extension } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import { FontFamily } from '@tiptap/extension-font-family'
import Placeholder from '@tiptap/extension-placeholder'
import { useCallback, useRef, useState } from 'react'
import {
  Bold, Italic, UnderlineIcon, Heading2, List, ListOrdered,
  Check, Loader2, Wand2, Download, Printer, Mic, MicOff, RefreshCw,
} from 'lucide-react'

// ── Custom FontSize extension (built on TextStyle) ────────────────────────────
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType
      unsetFontSize: () => ReturnType
    }
  }
}

const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() { return { types: ['textStyle'] } },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontSize: {
          default: null,
          parseHTML: el => el.style.fontSize || null,
          renderHTML: attrs => attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {},
        },
      },
    }]
  },
  addCommands() {
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setFontSize: (size: string) => ({ chain }: any) =>
        chain().setMark('textStyle', { fontSize: size }).run(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      unsetFontSize: () => ({ chain }: any) =>
        chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    }
  },
})

// ── Font options ──────────────────────────────────────────────────────────────
const FONT_SIZES = [
  { label: 'Small',   value: '12px' },
  { label: 'Normal',  value: '14px' },
  { label: 'Medium',  value: '16px' },
  { label: 'Large',   value: '18px' },
  { label: 'X-Large', value: '24px' },
]

const FONT_FAMILIES = [
  { label: 'Default', value: '' },
  { label: 'Serif',   value: 'Georgia, serif' },
  { label: 'Mono',    value: 'monospace' },
]

// CSS for the exported HTML file — mirrors globals.css tiptap-editor styles
const EXPORT_STYLES = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; line-height: 1.7; color: #374151; max-width: 800px; margin: 40px auto; padding: 0 20px; }
  h1 { font-size: 18px; font-weight: 700; color: #111827; margin: 20px 0 8px; }
  h2 { font-size: 16px; font-weight: 600; color: #111827; margin: 16px 0 6px; }
  h3 { font-size: 14px; font-weight: 600; color: #374151; margin: 12px 0 4px; }
  p { margin: 6px 0; }
  ul { list-style: disc; padding-left: 20px; margin: 6px 0; }
  ol { list-style: decimal; padding-left: 20px; margin: 6px 0; }
  li { margin: 3px 0; }
  strong { font-weight: 600; color: #111827; }
  em { font-style: italic; }
  u { text-decoration: underline; }
  code { background: #f3f4f6; border-radius: 3px; padding: 0 4px; font-family: monospace; font-size: 13px; }
  blockquote { border-left: 3px solid #e5e7eb; padding-left: 16px; color: #6b7280; margin: 8px 0; }
`

interface Props {
  entryId: string
  initialContent: string
  onContentChange?: (html: string) => void
}

export default function JournalEditor({ entryId, initialContent, onContentChange }: Props) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [fixingGrammar, setFixingGrammar] = useState(false)
  const [rewriting, setRewriting] = useState(false)
  const [dictating, setDictating] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)

  const save = useCallback(async (html: string) => {
    setStatus('saving')
    try {
      await fetch('/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: entryId, content: html }),
      })
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 2000)
    } catch {
      setStatus('idle')
    }
  }, [entryId])

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      FontFamily,
      FontSize,
      Placeholder.configure({ placeholder: 'Write your notes here…' }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: 'tiptap-editor focus:outline-none min-h-[200px] px-4 py-4',
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      onContentChange?.(html)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => save(html), 800)
    },
  })

  const toggleDictation = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR: any = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    if (!SR) { alert('Speech recognition is not supported in this browser.'); return }

    if (dictating && recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
      setDictating(false)
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition: any = new SR()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'en-US'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const results = Array.from(event.results as ArrayLike<SpeechRecognitionResult>)
      const transcript = results
        .slice(event.resultIndex)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any) => r[0].transcript as string)
        .join(' ')
      if (transcript && editor) {
        editor.commands.insertContent(transcript + ' ')
        const html = editor.getHTML()
        onContentChange?.(html)
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => save(html), 800)
      }
    }
    recognition.onerror = () => { setDictating(false); recognitionRef.current = null }
    recognition.onend   = () => { setDictating(false); recognitionRef.current = null }
    recognitionRef.current = recognition
    recognition.start()
    setDictating(true)
    editor?.commands.focus()
  }

  // AI helpers — use dedicated routes that call chat() directly, no persona interference
  const fixGrammar = async () => {
    if (!editor || fixingGrammar) return
    const text = editor.getText()
    if (!text.trim()) return
    setFixingGrammar(true)
    try {
      const res = await fetch('/api/journal/fix-grammar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await res.json() as { content?: string; error?: string }
      if (data.content) {
        editor.commands.setContent(
          `<p>${data.content.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`
        )
        save(editor.getHTML())
      }
    } finally {
      setFixingGrammar(false)
    }
  }

  const rewriteNote = async () => {
    if (!editor || rewriting) return
    const text = editor.getText()
    if (!text.trim()) return
    setRewriting(true)
    try {
      const res = await fetch('/api/journal/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await res.json() as { content?: string; error?: string }
      if (data.content) {
        editor.commands.setContent(
          `<p>${data.content.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`
        )
        save(editor.getHTML())
      }
    } finally {
      setRewriting(false)
    }
  }

  // Export as styled HTML — preserves fonts, bold, headings, lists
  const exportHtml = () => {
    if (!editor) return
    const html = editor.getHTML()
    const full = `<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n<title>Journal Note</title>\n<style>${EXPORT_STYLES}</style>\n</head>\n<body>${html}</body>\n</html>`
    const blob = new Blob([full], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'journal-note.html'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!editor) return null

  // Current text style attributes for selectors
  const currentFontSize = editor.getAttributes('textStyle').fontSize as string | undefined
  const currentFontFamily = editor.getAttributes('textStyle').fontFamily as string | undefined

  const selectClass = 'text-xs border border-gray-200 dark:border-zinc-700 rounded-md px-1.5 py-1 bg-white dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-zinc-500'

  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-3 py-2 border-b border-gray-100 dark:border-zinc-800 flex-wrap gap-y-1">

        {/* Font family */}
        <select
          value={currentFontFamily ?? ''}
          onChange={e => {
            const v = e.target.value
            if (v) editor.chain().focus().setFontFamily(v).run()
            else editor.chain().focus().unsetFontFamily().run()
          }}
          className={selectClass}
          title="Font family"
        >
          {FONT_FAMILIES.map(f => (
            <option key={f.label} value={f.value}>{f.label}</option>
          ))}
        </select>

        {/* Font size */}
        <select
          value={currentFontSize ?? '14px'}
          onChange={e => {
            const v = e.target.value
            if (v === '14px') editor.chain().focus().unsetFontSize().run()
            else editor.chain().focus().setFontSize(v).run()
          }}
          className={`${selectClass} w-20`}
          title="Font size"
        >
          {FONT_SIZES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        <div className="w-px h-4 bg-gray-200 dark:bg-zinc-700 mx-1" />

        {/* Text formatting */}
        <ToolButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">
          <Bold size={13} />
        </ToolButton>
        <ToolButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic">
          <Italic size={13} />
        </ToolButton>
        <ToolButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline">
          <UnderlineIcon size={13} />
        </ToolButton>

        <div className="w-px h-4 bg-gray-200 dark:bg-zinc-700 mx-1" />

        <ToolButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading">
          <Heading2 size={13} />
        </ToolButton>
        <ToolButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">
          <List size={13} />
        </ToolButton>
        <ToolButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list">
          <ListOrdered size={13} />
        </ToolButton>

        <div className="flex-1" />

        {/* Dictation */}
        <button
          onClick={toggleDictation}
          title={dictating ? 'Stop dictation' : 'Dictate (voice to text)'}
          className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors ${
            dictating
              ? 'text-red-600 bg-red-50 dark:bg-red-950 hover:bg-red-100 dark:hover:bg-red-900 animate-pulse'
              : 'text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800'
          }`}
        >
          {dictating ? <MicOff size={12} /> : <Mic size={12} />}
          <span>{dictating ? 'Stop' : 'Dictate'}</span>
        </button>

        <div className="w-px h-4 bg-gray-200 dark:bg-zinc-700 mx-1" />

        {/* AI: Fix grammar */}
        <button
          onClick={fixGrammar}
          disabled={fixingGrammar || rewriting}
          title="Fix grammar and spelling with AI"
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950 transition-colors disabled:opacity-40"
        >
          {fixingGrammar ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
          <span>Fix grammar</span>
        </button>

        {/* AI: Rewrite */}
        <button
          onClick={rewriteNote}
          disabled={rewriting || fixingGrammar}
          title="Rewrite and restructure with AI (no new facts added)"
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-colors disabled:opacity-40"
        >
          {rewriting ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          <span>Rewrite</span>
        </button>

        <div className="w-px h-4 bg-gray-200 dark:bg-zinc-700 mx-1" />

        {/* Export as HTML */}
        <button onClick={exportHtml} title="Download as HTML (preserves formatting and fonts)"
          className="p-1.5 rounded-lg text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
          <Download size={13} />
        </button>

        {/* Print */}
        <button onClick={() => window.print()} title="Print / save as PDF"
          className="p-1.5 rounded-lg text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors print:hidden">
          <Printer size={13} />
        </button>

        <div className="w-px h-4 bg-gray-200 dark:bg-zinc-700 mx-1" />

        <span className="text-[10px] text-gray-400 dark:text-zinc-500 px-1">
          {status === 'saving' && <><Loader2 size={10} className="inline animate-spin mr-0.5" />Saving</>}
          {status === 'saved'  && <><Check size={10} className="inline text-green-500 mr-0.5" />Saved</>}
        </span>
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  )
}

function ToolButton({ onClick, active, title, children }: {
  onClick: () => void
  active: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-md transition-colors ${active ? 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900' : 'text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-50 hover:bg-gray-100 dark:hover:bg-zinc-800'}`}
    >
      {children}
    </button>
  )
}
