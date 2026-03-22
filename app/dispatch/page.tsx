import { prisma } from '@/lib/db'
import { formatRelativeDate } from '@/lib/utils'
import { MessageSquare, ArrowRight, Trash2 } from 'lucide-react'
import Link from 'next/link'
import DispatchChatList from './DispatchChatList'

export const dynamic = 'force-dynamic'

export default async function DispatchPage() {
  const chats = await prisma.dispatchChat.findMany({
    orderBy: { updatedAt: 'desc' },
  })

  const serialized = chats.map(c => {
    let messages: Array<{ role: string; content: string }> = []
    try { messages = JSON.parse(c.messages) } catch {}
    return {
      id: c.id,
      title: c.title,
      messageCount: messages.length,
      preview: messages.find(m => m.role === 'assistant')?.content.slice(0, 100) ?? '',
      updatedAt: c.updatedAt.toISOString(),
    }
  })

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Dispatch</h1>
          <p className="text-gray-500 text-sm mt-0.5">Saved AI conversations about your reports</p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 bg-gray-900 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
        >
          <MessageSquare size={13} />
          New chat
        </Link>
      </div>

      {serialized.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-4">
            <MessageSquare size={20} className="text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-700 mb-1">No saved chats yet</p>
          <p className="text-xs text-gray-400 mb-4">Open Dispatch from the Overview page and save a conversation</p>
          <Link href="/" className="text-sm text-gray-600 underline hover:text-gray-900">Go to Overview</Link>
        </div>
      ) : (
        <DispatchChatList chats={serialized} />
      )}
    </div>
  )
}
