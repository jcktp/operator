'use client'

import { useEditor, EditorContent, Extension, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import { FontFamily } from '@tiptap/extension-font-family'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Highlight from '@tiptap/extension-highlight'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { useCallback, useRef, useState } from 'react'
import {
 Bold, Italic, UnderlineIcon, Heading1, Heading2, Heading3, List, ListOrdered,
 Check, Loader2, Wand2, Download, Printer, Mic, MicOff, RefreshCw,
 Strikethrough, Quote, Code2, Minus, Link as LinkIcon, Image as ImageIcon,
 Highlighter, ListChecks,
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
 /** Called once when the Tiptap editor instance is ready. */
 onReady?: (editor: Editor) => void
 /** When true, skip the internal /api/journal autosave — parent handles saving via onContentChange. */
 disableAutosave?: boolean
}

export default function JournalEditor({ entryId, initialContent, onContentChange, onReady, disableAutosave }: Props) {
 const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
 const [fixingGrammar, setFixingGrammar] = useState(false)
 const [rewriting, setRewriting] = useState(false)
 const [dictating, setDictating] = useState(false)
 const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const recognitionRef = useRef<{ stop(): void } | null>(null)

 const save = useCallback(async (html: string) => {
 if (disableAutosave) return   // parent handles saving via onContentChange
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
 }, [entryId, disableAutosave])

 const editor = useEditor({
 immediatelyRender: false,
 extensions: [
 StarterKit,
 Underline,
 TextStyle,
 FontFamily,
 FontSize,
 Image.configure({ inline: false, allowBase64: true, HTMLAttributes: { class: 'tiptap-image' } }),
 Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { class: 'tiptap-link', rel: 'noopener noreferrer' } }),
 Highlight.configure({ multicolor: false }),
 TaskList,
 TaskItem.configure({ nested: true }),
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
 onCreate: ({ editor }) => {
 onReady?.(editor)
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

 // Link prompt — toggles link on selection, prompts for URL
 const setLink = useCallback(() => {
   if (!editor) return
   const previous = editor.getAttributes('link').href as string | undefined
   const url = window.prompt('Link URL (leave blank to remove):', previous ?? '')
   if (url === null) return
   if (url === '') {
     editor.chain().focus().extendMarkRange('link').unsetLink().run()
     return
   }
   editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
 }, [editor])

 // Image insert — accepts a URL, or a local file (base64-embedded for portability)
 const fileInputRef = useRef<HTMLInputElement | null>(null)
 const insertImageFromUrl = useCallback(() => {
   if (!editor) return
   const url = window.prompt('Image URL:')
   if (!url) return
   editor.chain().focus().setImage({ src: url }).run()
 }, [editor])
 const onImageFileChosen = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
   const file = e.target.files?.[0]
   e.target.value = ''
   if (!file || !editor) return
   const reader = new FileReader()
   reader.onload = () => {
     const dataUrl = String(reader.result ?? '')
     if (dataUrl) editor.chain().focus().setImage({ src: dataUrl }).run()
   }
   reader.readAsDataURL(file)
 }, [editor])

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
 <ToolButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough">
 <Strikethrough size={13} />
 </ToolButton>
 <ToolButton onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} title="Highlight">
 <Highlighter size={13} />
 </ToolButton>

 <div className="w-px h-4 bg-[var(--surface-3)] mx-1" />

 <ToolButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1">
 <Heading1 size={13} />
 </ToolButton>
 <ToolButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">
 <Heading2 size={13} />
 </ToolButton>
 <ToolButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3">
 <Heading3 size={13} />
 </ToolButton>
 <ToolButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">
 <List size={13} />
 </ToolButton>
 <ToolButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list">
 <ListOrdered size={13} />
 </ToolButton>
 <ToolButton onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')} title="Task list (checkboxes)">
 <ListChecks size={13} />
 </ToolButton>

 <div className="w-px h-4 bg-[var(--surface-3)] mx-1" />

 <ToolButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Blockquote">
 <Quote size={13} />
 </ToolButton>
 <ToolButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Code block">
 <Code2 size={13} />
 </ToolButton>
 <ToolButton onClick={() => editor.chain().focus().setHorizontalRule().run()} active={false} title="Horizontal rule">
 <Minus size={13} />
 </ToolButton>

 <div className="w-px h-4 bg-[var(--surface-3)] mx-1" />

 <ToolButton onClick={setLink} active={editor.isActive('link')} title="Link">
 <LinkIcon size={13} />
 </ToolButton>
 <ToolButton onClick={() => fileInputRef.current?.click()} active={false} title="Insert image (file)">
 <ImageIcon size={13} />
 </ToolButton>
 <ToolButton onClick={insertImageFromUrl} active={false} title="Insert image from URL">
 <span className="text-[10px] font-semibold leading-none">URL</span>
 </ToolButton>
 <input
 ref={fileInputRef}
 type="file"
 accept="image/*"
 className="hidden"
 onChange={onImageFileChosen}
 />

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
 className={`p-1.5 rounded-md transition-colors ${active ? 'bg-[var(--ink)] text-[var(--ink-contrast)]' : 'text-[var(--text-muted)] hover:text-[var(--text-bright)] hover:bg-[var(--surface-2)]'}`}
 >
 {children}
 </button>
 )
}
