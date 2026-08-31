// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const escapeFlashHtml = (raw) => String(raw || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

export const isSafeFlashMarkdownUrl = (raw) => {
  const value = String(raw || '').trim().toLowerCase()
  if (!value) return false
  if (value.startsWith('javascript:') || value.startsWith('vbscript:') || value.startsWith('data:text/html')) {
    return false
  }
  return [
    'http://',
    'https://',
    'mailto:',
    'tel:',
    '#',
    '/',
    './',
    '../'
  ].some((prefix) => value.startsWith(prefix))
}

export const renderFlashInlineMarkdown = (source) => {
  let text = escapeFlashHtml(source)
  text = text.replace(/`([^`\n]+)`/g, '<code>$1</code>')
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>')
  text = text.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
  text = text.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, '$1<em>$2</em>')
  text = text.replace(/~~([^~]+)~~/g, '<del>$1</del>')
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/g, (_, label, href, title = '') => {
    if (!isSafeFlashMarkdownUrl(href)) return label
    const safeHref = escapeFlashHtml(href)
    const safeTitle = title ? ` title="${escapeFlashHtml(title)}"` : ''
    return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer"${safeTitle}>${label}</a>`
  })
  return text
}

export const renderFlashMarkdownTable = (lines) => {
  if (!Array.isArray(lines) || lines.length < 2) return ''
  const divider = String(lines[1] || '').trim()
  if (!/^\|?[\s:-]+\|[\s|:-]*$/.test(divider)) return ''

  const splitRow = (row) => String(row || '')
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => renderFlashInlineMarkdown(cell.trim()))

  const header = splitRow(lines[0])
  const bodyRows = lines.slice(2).map(splitRow)
  const thead = `<thead><tr>${header.map((cell) => `<th>${cell}</th>`).join('')}</tr></thead>`
  const tbody = bodyRows.length
    ? `<tbody>${bodyRows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>`
    : '<tbody></tbody>'
  return `<table>${thead}${tbody}</table>`
}

export const renderFlashMarkdown = (rawContent) => {
  const source = String(rawContent || '').trim()
  if (!source) return ''

  const codeBlocks = []
  const codeToken = (index) => `@@FLASH_CODE_${index}@@`
  const text = source.replace(/```([a-zA-Z0-9_-]*)\r?\n([\s\S]*?)```/g, (_, lang = '', code = '') => {
    const index = codeBlocks.length
    codeBlocks.push({
      lang: String(lang || '').trim(),
      code: String(code || '')
    })
    return `\n${codeToken(index)}\n`
  })

  const blocks = text.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean)
  const htmlBlocks = []
  blocks.forEach((block) => {
    if (/^@@FLASH_CODE_\d+@@$/.test(block)) {
      const index = Number(block.replace(/\D+/g, ''))
      const node = codeBlocks[index]
      if (!node) return
      const langTag = node.lang ? `<span class="lang">${escapeFlashHtml(node.lang)}</span>` : ''
      htmlBlocks.push(`<pre class="md-code"><code>${escapeFlashHtml(node.code)}</code>${langTag}</pre>`)
      return
    }

    const tableLines = block.split(/\r?\n/).map((line) => line.trim())
    const tableHtml = renderFlashMarkdownTable(tableLines)
    if (tableHtml) {
      htmlBlocks.push(tableHtml)
      return
    }

    if (block.startsWith('>')) {
      const lines = block
        .split(/\r?\n/)
        .map((line) => renderFlashInlineMarkdown(line.replace(/^>\s?/, '')))
      htmlBlocks.push(`<blockquote>${lines.join('<br/>')}</blockquote>`)
      return
    }

    const headingMatch = block.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      const level = Math.min(6, headingMatch[1].length)
      htmlBlocks.push(`<h${level}>${renderFlashInlineMarkdown(headingMatch[2])}</h${level}>`)
      return
    }

    const listLines = block.split(/\r?\n/)
    const ordered = listLines.every((line) => /^\d+\.\s+/.test(line.trim()))
    const unordered = listLines.every((line) => /^[-*]\s+/.test(line.trim()))
    if (ordered || unordered) {
      const tag = ordered ? 'ol' : 'ul'
      const items = listLines
        .map((line) => line.replace(ordered ? /^\d+\.\s+/ : /^[-*]\s+/, ''))
        .map((line) => `<li>${renderFlashInlineMarkdown(line)}</li>`)
        .join('')
      htmlBlocks.push(`<${tag}>${items}</${tag}>`)
      return
    }

    const paragraph = block
      .split(/\r?\n/)
      .map((line) => renderFlashInlineMarkdown(line))
      .join('<br/>')
    htmlBlocks.push(`<p>${paragraph}</p>`)
  })

  let html = htmlBlocks.join('')
  codeBlocks.forEach((node, index) => {
    const langTag = node.lang ? `<span class="lang">${escapeFlashHtml(node.lang)}</span>` : ''
    const codeHtml = `<pre class="md-code"><code>${escapeFlashHtml(node.code)}</code>${langTag}</pre>`
    html = html.replace(new RegExp(codeToken(index), 'g'), codeHtml)
  })
  return html
}
