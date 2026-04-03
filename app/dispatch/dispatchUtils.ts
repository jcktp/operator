/** Convert markdown text to HTML suitable for storing in the Tiptap-based journal editor. */
export function markdownToHtml(md: string): string {
  const lines = md.split('\n')
  const out: string[] = []
  let i = 0

  const escHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const inlineFormat = (s: string): string =>
    escHtml(s)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')

  while (i < lines.length) {
    const line = lines[i]

    // Fenced code block
    if (line.trimStart().startsWith('```')) {
      const fence = line.match(/^(\s*```)/)?.[1] ?? '```'
      i++
      const codeLines: string[] = []
      while (i < lines.length && !lines[i].startsWith(fence.trim())) {
        codeLines.push(escHtml(lines[i]))
        i++
      }
      out.push(`<pre><code>${codeLines.join('\n')}</code></pre>`)
      i++
      continue
    }

    // Headings
    const h3 = line.match(/^###\s+(.+)/)
    if (h3) { out.push(`<h3>${inlineFormat(h3[1])}</h3>`); i++; continue }
    const h2 = line.match(/^##\s+(.+)/)
    if (h2) { out.push(`<h2>${inlineFormat(h2[1])}</h2>`); i++; continue }
    const h1 = line.match(/^#\s+(.+)/)
    if (h1) { out.push(`<h2>${inlineFormat(h1[1])}</h2>`); i++; continue } // map # → h2 for editor compat

    // Unordered list — collect consecutive items
    if (/^[-*]\s/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        items.push(`<li><p>${inlineFormat(lines[i].replace(/^[-*]\s/, ''))}</p></li>`)
        i++
      }
      out.push(`<ul>${items.join('')}</ul>`)
      continue
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(`<li><p>${inlineFormat(lines[i].replace(/^\d+\.\s/, ''))}</p></li>`)
        i++
      }
      out.push(`<ol>${items.join('')}</ol>`)
      continue
    }

    // Blank line — skip (paragraph breaks handled by grouping)
    if (line.trim() === '') { i++; continue }

    // Regular paragraph — collect consecutive non-blank, non-special lines
    const paraLines: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^#{1,3}\s/.test(lines[i]) &&
      !/^[-*]\s/.test(lines[i]) &&
      !/^\d+\.\s/.test(lines[i]) &&
      !lines[i].trimStart().startsWith('```')
    ) {
      paraLines.push(inlineFormat(lines[i]))
      i++
    }
    if (paraLines.length) out.push(`<p>${paraLines.join('<br>')}</p>`)
  }

  return out.join('')
}

export function downloadCode(code: string, lang: string) {
  const ext: Record<string, string> = {
    python: 'py', javascript: 'js', typescript: 'ts', jsx: 'jsx', tsx: 'tsx',
    css: 'css', html: 'html', sql: 'sql', json: 'json', csv: 'csv',
    markdown: 'md', md: 'md', bash: 'sh', shell: 'sh', txt: 'txt',
  }
  const extension = ext[lang.toLowerCase()] ?? lang ?? 'txt'
  const mime = extension === 'csv' ? 'text/csv' : extension === 'json' ? 'application/json' : 'text/plain'
  const blob = new Blob([code], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `dispatch-output.${extension}`
  a.click()
  URL.revokeObjectURL(url)
}
