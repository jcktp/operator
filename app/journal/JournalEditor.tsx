'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import { useCallback, useRef, useState } from 'react'
import {
  Bold, Italic, UnderlineIcon, Heading2, List, ListOrdered,
  Check, Loader2, Wand2, Download, Printer,
} from 'lucide-react'

interface Props {
  entryId: string
  initialContent: string
  onContentChange?: (html: string) => void
}

export default function JournalEditor({ entryId, initialContent, onContentChange }: Props) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [fixingGrammar, setFixingGrammar] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
      const data = await res.json()
      if (data.content) {
        editor.commands.setContent(`<p>${data.content.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`)
        save(editor.getHTML())
      }
    } finally {
      setFixingGrammar(false)
    }
  }

  const exportMarkdown = () => {
    if (!editor) return
    const html = editor.getHTML()
    // Very simple HTML to markdown
    const md = html
      .replace(/<h1[^>]*>(.*?)<\/h1>/g, '# $1\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/g, '## $1\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/g, '### $1\n')
      .replace(/<strong[^>]*>(.*?)<\/strong>/g, '**$1**')
      .replace(/<em[^>]*>(.*?)<\/em>/g, '*$1*')
      .replace(/<u[^>]*>(.*?)<\/u>/g, '_$1_')
      .replace(/<li[^>]*>(.*?)<\/li>/g, '- $1\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'journal-note.md'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!editor) return null

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-3 py-2 border-b border-gray-100 flex-wrap">
        <ToolButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">
          <Bold size={13} />
        </ToolButton>
        <ToolButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic">
          <Italic size={13} />
        </ToolButton>
        <ToolButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline">
          <UnderlineIcon size={13} />
        </ToolButton>
        <div className="w-px h-4 bg-gray-200 mx-1" />
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
        {/* AI grammar fix */}
        <button
          onClick={fixGrammar}
          disabled={fixingGrammar}
          title="Fix grammar with AI"
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg text-purple-600 hover:bg-purple-50 transition-colors disabled:opacity-40"
        >
          {fixingGrammar ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
          <span>Fix grammar</span>
        </button>
        <div className="w-px h-4 bg-gray-200 mx-1" />
        <button onClick={exportMarkdown} title="Download as Markdown"
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
          <Download size={13} />
        </button>
        <button onClick={() => window.print()} title="Print / PDF"
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors print:hidden">
          <Printer size={13} />
        </button>
        <div className="w-px h-4 bg-gray-200 mx-1" />
        <span className="text-[10px] text-gray-400 px-1">
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
      className={`p-1.5 rounded-md transition-colors ${active ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
    >
      {children}
    </button>
  )
}
