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
import SelectField from '@/components/SelectField'

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
 { label: 'Small', value: '12px' },
 { label: 'Normal', value: '14px' },
 { label: 'Medium', value: '16px' },
 { label: 'Large', value: '18px' },
 { label: 'X-Large', value: '24px' },
]

const FONT_FAMILIES = [
 { label: 'Default', value: '' },
 { label: 'Serif', value: 'Georgia, serif' },
 { label: 'Mono', value: 'monospace' },
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
 const recognitionRef = useRef<{ stop(): void } | null>(null)

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
 // Web Speech API — not in all TS lib versions, access via window property
 type SpeechRecognitionCtor = { new(): { continuous: boolean; interimResults: boolean; lang: string; start(): void; stop(): void; onresult: ((e: { results: ArrayLike<{ 0: { transcript: string } }>; resultIndex: number }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null } }
 const w = window as Window & { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor }
 const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition
 if (!SR) { alert('Speech recognition is not supported in this browser.'); return }

 if (dictating && recognitionRef.current) {
 recognitionRef.current.stop()
 recognitionRef.current = null
 setDictating(false)
 return
 }

 const recognition = new SR()
 recognition.continuous = true
 recognition.interimResults = false
 recognition.lang = 'en-US'

 recognition.onresult = (event) => {
 const results = Array.from(event.results)
 const transcript = results
 .slice(event.resultIndex)
 .map((r) => r[0].transcript)
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
 recognition.onend = () => { setDictating(false); recognitionRef.current = null }
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

 return (
 <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] overflow-hidden">
 {/* Toolbar */}
 <div className="flex items-center gap-0.5 px-3 py-2 border-b border-[var(--border)] flex-wrap gap-y-1">

 {/* Font family */}
 <SelectField
   value={currentFontFamily ?? ''}
   onChange={v => {
     if (v) editor.chain().focus().setFontFamily(v).run()
     else editor.chain().focus().unsetFontFamily().run()
   }}
   options={FONT_FAMILIES.map(f => ({ value: f.value, label: f.label }))}
   className="w-24"
 />

 {/* Font size */}
 <SelectField
   value={currentFontSize ?? '14px'}
   onChange={v => {
     if (v === '14px') editor.chain().focus().unsetFontSize().run()
     else editor.chain().focus().setFontSize(v).run()
   }}
   options={FONT_SIZES.map(s => ({ value: s.value, label: s.label }))}
   className="w-20"
 />

 <div className="w-px h-4 bg-[var(--surface-3)] mx-1" />

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

 <div className="w-px h-4 bg-[var(--surface-3)] mx-1" />

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
 className={`flex items-center gap-1 text-xs px-2 py-1 rounded-[4px] transition-colors ${
 dictating
 ? 'text-[var(--red)] bg-[var(--red-dim)] hover:bg-red-100 animate-pulse'
 : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)]'
 }`}
 >
 {dictating ? <MicOff size={12} /> : <Mic size={12} />}
 <span>{dictating ? 'Stop' : 'Dictate'}</span>
 </button>

 <div className="w-px h-4 bg-[var(--surface-3)] mx-1" />

 {/* AI: Fix grammar */}
 <button
 onClick={fixGrammar}
 disabled={fixingGrammar || rewriting}
 title="Fix grammar and spelling with AI"
 className="flex items-center gap-1 text-xs px-2 py-1 rounded-[4px] text-purple-600 hover:bg-[var(--blue-dim)] transition-colors disabled:opacity-40"
 >
 {fixingGrammar ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
 <span>Fix grammar</span>
 </button>

 {/* AI: Rewrite */}
 <button
 onClick={rewriteNote}
 disabled={rewriting || fixingGrammar}
 title="Rewrite and restructure with AI (no new facts added)"
 className="flex items-center gap-1 text-xs px-2 py-1 rounded-[4px] text-[var(--blue)] hover:bg-[var(--blue-dim)] transition-colors disabled:opacity-40"
 >
 {rewriting ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
 <span>Rewrite</span>
 </button>

 <div className="w-px h-4 bg-[var(--surface-3)] mx-1" />

 {/* Export as HTML */}
 <button onClick={exportHtml} title="Download as HTML (preserves formatting and fonts)"
 className="p-1.5 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--text-body)] hover:bg-[var(--surface-2)] transition-colors">
 <Download size={13} />
 </button>

 {/* Print */}
 <button onClick={() => window.print()} title="Print / save as PDF"
 className="p-1.5 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--text-body)] hover:bg-[var(--surface-2)] transition-colors print:hidden">
 <Printer size={13} />
 </button>

 <div className="w-px h-4 bg-[var(--surface-3)] mx-1" />

 <span className="text-[10px] text-[var(--text-muted)] px-1">
 {status === 'saving' && <><Loader2 size={10} className="inline animate-spin mr-0.5" />Saving</>}
 {status === 'saved' && <><Check size={10} className="inline text-[var(--green)] mr-0.5" />Saved</>}
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
 className={`p-1.5 rounded-md transition-colors ${active ? 'bg-[var(--ink)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-bright)] hover:bg-[var(--surface-2)]'}`}
 >
 {children}
 </button>
 )
}
