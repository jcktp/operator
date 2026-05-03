import { NextResponse } from 'next/server'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from 'docx'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { getReportsRoot, sanitizeProjectName } from '@/lib/reports-folder'

/**
 * GET /api/stories/[id]/export?format=html|docx
 *
 * Returns the file as a download AND writes a copy to
 *   ~/Documents/Operator Reports/<project>/exports/<title> — <YYYY-MM-DD>.<ext>
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const { id } = await params
  const url = new URL(req.url)
  const format = (url.searchParams.get('format') ?? 'html').toLowerCase()
  if (format !== 'html' && format !== 'docx') {
    return NextResponse.json({ error: 'format must be html or docx' }, { status: 400 })
  }

  // Story = Project. id is projectId.
  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, name: true, narrative: true },
  })
  if (!project) return NextResponse.json({ error: 'Story not found' }, { status: 404 })

  // Build the export filename
  const datePart = new Date().toISOString().slice(0, 10)
  const titleSlug = (project.name || 'Untitled')
    .replace(/[/\\:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
  const ext = format === 'docx' ? 'docx' : 'html'
  const fileName = `${titleSlug} — ${datePart}.${ext}`

  // Build the file content
  let bytes: Buffer
  let contentType: string
  if (format === 'html') {
    contentType = 'text/html; charset=utf-8'
    bytes = Buffer.from(buildHtml(project.name, project.narrative), 'utf8')
  } else {
    contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    bytes = await buildDocx(project.name, project.narrative)
  }

  // Save a server-side copy
  try {
    const projectFolder = sanitizeProjectName(project.name)
    const exportsDir = join(getReportsRoot(), projectFolder, 'exports')
    mkdirSync(exportsDir, { recursive: true })
    writeFileSync(join(exportsDir, fileName), bytes)
  } catch (err) {
    // Don't fail the response if the local copy fails — still let the user download.
    console.error('[stories/export] failed to write local copy:', err)
  }

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
      'Cache-Control': 'no-store',
    },
  })
}

// ── HTML export ────────────────────────────────────────────────────────────────

const HTML_STYLES = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; line-height: 1.7; color: #1a1a1a; max-width: 760px; margin: 40px auto; padding: 0 24px; }
  h1.story-title { font-size: 28px; font-weight: 700; color: #111; margin: 0 0 8px; letter-spacing: -0.02em; }
  h1 { font-size: 22px; font-weight: 700; color: #111; margin: 24px 0 8px; }
  h2 { font-size: 18px; font-weight: 600; color: #111; margin: 20px 0 6px; }
  h3 { font-size: 15px; font-weight: 600; color: #1a1a1a; margin: 16px 0 4px; }
  p { margin: 8px 0; }
  ul { list-style: disc; padding-left: 20px; margin: 8px 0; }
  ol { list-style: decimal; padding-left: 20px; margin: 8px 0; }
  li { margin: 3px 0; }
  strong { font-weight: 600; color: #111; }
  em { font-style: italic; }
  u { text-decoration: underline; }
  s, del { text-decoration: line-through; }
  code { background: #f3f4f6; border-radius: 3px; padding: 0 4px; font-family: monospace; font-size: 13px; }
  pre { background: #f3f4f6; border-radius: 6px; padding: 12px 14px; margin: 12px 0; overflow-x: auto; font-family: monospace; font-size: 13px; }
  blockquote { border-left: 3px solid #e5e7eb; padding-left: 16px; color: #555; margin: 12px 0; }
  a { color: #2563eb; text-decoration: underline; }
  img { max-width: 100%; height: auto; border-radius: 6px; margin: 12px 0; display: block; }
  hr { border: 0; border-top: 1px solid #e5e7eb; margin: 16px 0; }
  mark { background: #fef08a; padding: 0 2px; border-radius: 2px; }
  ul[data-type="taskList"] { list-style: none; padding-left: 0; }
  ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 6px; }
  .meta { font-family: monospace; font-size: 11px; color: #888; margin-bottom: 24px; padding-bottom: 12px; border-bottom: 1px solid #e5e7eb; }
`

function buildHtml(title: string, content: string): string {
  const safeTitle = escapeHtml(title || 'Untitled')
  const exportedAt = new Date().toLocaleString()
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${safeTitle}</title>
<style>${HTML_STYLES}</style>
</head>
<body>
<h1 class="story-title">${safeTitle}</h1>
<p class="meta">Exported from Operator · ${exportedAt}</p>
${content || '<p><em>(empty draft)</em></p>'}
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

// ── DOCX export ────────────────────────────────────────────────────────────────

/**
 * Convert the Tiptap HTML to a list of docx Paragraphs. Keeps it simple — we walk
 * the top-level block elements and turn each into a Paragraph with the right
 * heading level / list style. Inline marks (bold/italic/etc.) aren't deep-mapped
 * yet; for the v1 we extract plain text from each block.
 */
async function buildDocx(title: string, htmlContent: string): Promise<Buffer> {
  const blocks: Paragraph[] = []

  // Title
  blocks.push(new Paragraph({
    text: title || 'Untitled',
    heading: HeadingLevel.TITLE,
  }))
  blocks.push(new Paragraph({
    children: [new TextRun({ text: `Exported from Operator · ${new Date().toLocaleString()}`, italics: true, color: '888888', size: 18 })],
    spacing: { after: 400 },
  }))

  if (htmlContent) {
    for (const para of htmlToParagraphs(htmlContent)) {
      blocks.push(para)
    }
  } else {
    blocks.push(new Paragraph({ children: [new TextRun({ text: '(empty draft)', italics: true, color: '888888' })] }))
  }

  const doc = new Document({
    sections: [{ properties: {}, children: blocks }],
  })
  return await Packer.toBuffer(doc)
}

const BLOCK_REGEX = /<(h[1-6]|p|ul|ol|blockquote|hr|pre)([^>]*)>([\s\S]*?)<\/\1>|<hr[^>]*\/?>/gi

function htmlToParagraphs(html: string): Paragraph[] {
  const out: Paragraph[] = []
  let m: RegExpExecArray | null
  // Reset regex
  BLOCK_REGEX.lastIndex = 0
  while ((m = BLOCK_REGEX.exec(html)) !== null) {
    const tag = (m[1] || 'hr').toLowerCase()
    const inner = m[3] ?? ''
    const text = stripTags(inner)

    if (tag === 'h1') {
      out.push(new Paragraph({ text, heading: HeadingLevel.HEADING_1 }))
    } else if (tag === 'h2') {
      out.push(new Paragraph({ text, heading: HeadingLevel.HEADING_2 }))
    } else if (tag === 'h3') {
      out.push(new Paragraph({ text, heading: HeadingLevel.HEADING_3 }))
    } else if (tag === 'h4' || tag === 'h5' || tag === 'h6') {
      out.push(new Paragraph({ text, heading: HeadingLevel.HEADING_4 }))
    } else if (tag === 'p') {
      out.push(new Paragraph({ text }))
    } else if (tag === 'blockquote') {
      out.push(new Paragraph({
        children: [new TextRun({ text, italics: true })],
        indent: { left: 360 },
      }))
    } else if (tag === 'pre') {
      out.push(new Paragraph({
        children: [new TextRun({ text, font: 'Courier New', size: 20 })],
      }))
    } else if (tag === 'ul' || tag === 'ol') {
      // Simple list — extract <li> items
      const itemRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi
      let li
      while ((li = itemRegex.exec(inner)) !== null) {
        out.push(new Paragraph({
          text: stripTags(li[1]),
          bullet: tag === 'ul' ? { level: 0 } : undefined,
          numbering: tag === 'ol' ? { reference: 'default-numbering', level: 0 } : undefined,
        }))
      }
    } else if (tag === 'hr') {
      out.push(new Paragraph({ border: { bottom: { color: 'CCCCCC', space: 1, style: 'single', size: 6 } } }))
    }
  }
  // If nothing matched, fall back to the whole text as a single paragraph
  if (out.length === 0) {
    const fallback = stripTags(html).trim()
    if (fallback) out.push(new Paragraph({ text: fallback }))
  }
  return out
}

function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}
