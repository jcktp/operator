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
