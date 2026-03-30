#!/usr/bin/env node
// Copies TimelineJS assets to public/ so they can be loaded via <script> tag.
// Runs automatically after `npm install` via the postinstall hook.
const fs = require('fs')
const path = require('path')

const src = path.join(__dirname, '../node_modules/@knight-lab/timelinejs/dist')
const dest = path.join(__dirname, '../public/timelinejs')

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true })
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const srcPath = path.join(from, entry.name)
    const destPath = path.join(to, entry.name)
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

try {
  fs.mkdirSync(dest, { recursive: true })
  fs.copyFileSync(path.join(src, 'js/timeline.js'), path.join(dest, 'timeline.js'))
  fs.copyFileSync(path.join(src, 'css/timeline.css'), path.join(dest, 'timeline.css'))
  copyDir(path.join(src, 'css/fonts'), path.join(dest, 'fonts'))
  copyDir(path.join(src, 'css/icons'), path.join(dest, 'icons'))
  console.log('✓ TimelineJS assets copied to public/timelinejs/')
} catch (e) {
  // Non-fatal — assets may already exist or package may not be installed yet
  console.warn('copy-assets: skipped:', e.message)
}
