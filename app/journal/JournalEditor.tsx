'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import { useCallback, useRef, useState } from 'react'
import {
  Bold, Italic, UnderlineIcon, Heading2, List, ListOrdered,
  Check, Loader2, Wand2, Download, Printer, Mic, MicOff, RefreshCw,
} from 'lucide-react'

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
    if (!SR) {
      alert('Speech recognition is not supported in this browser.')
      return
    }

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

    recognition.onerror = () => {
      setDictating(false)
      recognitionRef.current = null
    }

    recognition.onend = () => {
      setDictating(false)
      recognitionRef.current = null
    }

    recognitionRef.current = recognition
    recognition.start()
    setDictating(true)
    editor?.commands.focus()
  }

  const readStreamContent = async (res: Response): Promise<string> => {
    if (!res.ok || !res.body) return ''
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = '', full = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const ev = JSON.parse(line) as { t: string; v?: string }
          if (ev.t === 'chunk' && ev.v) full += ev.v
        } catch {}
      }
    }
    return full
  }

  const fixGrammar = async () => {
    if (!editor || fixingGrammar) return
    const text = editor.getText()
    if (!text.trim()) return
    setFixingGrammar(true)
    try {
      const res = await fetch('/api/dispatch/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `Fix the grammar and improve the clarity of this text. Return ONLY the corrected text with no commentary:\n\n${text}` }],
          context: '',
        }),
      })
      const content = await readStreamContent(res)
      if (content) {
        editor.commands.setContent(`<p>${content.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`)
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
        editor.commands.setContent(`<p>${data.content.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`)
        save(editor.getHTML())
      }
    } finally {
      setRewriting(false)
    }
  }

  const exportText = () => {
    if (!editor) return
    const text = editor.getText()
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'journal-note.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!editor) return null

  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-3 py-2 border-b border-gray-100 dark:border-zinc-800 flex-wrap">
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
        {/* AI grammar fix */}
        <button
          onClick={fixGrammar}
          disabled={fixingGrammar}
          title="Fix grammar with AI"
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950 transition-colors disabled:opacity-40"
        >
          {fixingGrammar ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
          <span>Fix grammar</span>
        </button>
        {/* AI rewrite */}
        <button
          onClick={rewriteNote}
          disabled={rewriting}
          title="Rewrite and restructure with AI (no new facts added)"
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-colors disabled:opacity-40"
        >
          {rewriting ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          <span>Rewrite</span>
        </button>
        <div className="w-px h-4 bg-gray-200 dark:bg-zinc-700 mx-1" />
        <button onClick={exportText} title="Download as .txt"
          className="p-1.5 rounded-lg text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
          <Download size={13} />
        </button>
        <button onClick={() => window.print()} title="Print / PDF"
          className="p-1.5 rounded-lg text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors print:hidden">
          <Printer size={13} />
        </button>
        <div className="w-px h-4 bg-gray-200 dark:bg-zinc-700 mx-1" />
        <span className="text-[10px] text-gray-400 dark:text-zinc-500 px-1">
          {status === 'saving' && <><Loader2 size={10} className="inline animate-spin mr-0.5" />Saving</>}
          {status === 'saved' && <><Check size={10} className="inline text-green-500 mr-0.5" />Saved</>}
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
