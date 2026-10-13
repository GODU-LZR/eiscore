// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 EISCore contributors

// outerHTML does not serialize live input values. Print their text instead.
export function cloneDocumentForPrint(element) {
  const clone = element.cloneNode(true)
  clone.querySelectorAll('script').forEach((script) => script.remove())
  for (const node of [clone, ...clone.querySelectorAll('*')]) {
    for (const attribute of Array.from(node.attributes || [])) {
      if (attribute.name.toLowerCase().startsWith('on')) node.removeAttribute(attribute.name)
    }
  }
  const selector = 'input, textarea, select'
  const fields = element.querySelectorAll(selector)
  clone.querySelectorAll(selector).forEach((field, index) => {
    const source = fields[index]
    const value = source.tagName === 'SELECT'
      ? Array.from(source.selectedOptions, (option) => option.textContent).join(', ')
      : ['checkbox', 'radio'].includes(source.type)
        ? source.checked ? '✓' : ''
        : source.type === 'hidden' ? '' : source.value
    field.replaceWith(field.ownerDocument.createTextNode(value || ''))
  })
  return clone
}
