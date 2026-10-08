// SPDX-License-Identifier: AGPL-3.0-or-later
import axios from 'axios'

const serviceIds = new Set(['quality-delivery', 'technical-support'])
const safeImage = (value) => typeof value === 'string'
  && /^\/enterprise-assets\/[a-zA-Z0-9_./-]+$/.test(value)
  && !value.split('/').includes('..')

export function validatePublicServiceContent(content) {
  if (content?.schemaVersion !== 1 || !content.locales?.['zh-CN']) {
    throw new Error('Invalid public service content')
  }
  for (const locale of Object.values(content.locales)) {
    if (!locale?.ui || !Array.isArray(locale.pages) || locale.pages.length !== 2
      || new Set(locale.pages.map(page => page?.id)).size !== 2) {
      throw new Error('Invalid public service pages')
    }
    for (const page of locale.pages) {
      if (!serviceIds.has(page?.id) || !page.title || !page.summary || !safeImage(page.imageUrl)
        || !Array.isArray(page.sections) || !page.sections.length
        || !Array.isArray(page.requirements) || !Array.isArray(page.steps)
        || !Array.isArray(page.faq)) throw new Error('Invalid public service page')
      for (const section of page.sections) {
        if (!section?.title || !Array.isArray(section.items)
          || section.items.some(item => !item?.title || !item?.description)) {
          throw new Error('Invalid public service section')
        }
      }
      if (page.requirements.some(item => !item?.label || !item?.value)
        || page.steps.some(item => !item?.title || !item?.description)
        || page.faq.some(item => !item?.question || !item?.answer)) {
        throw new Error('Invalid public service details')
      }
    }
  }
  return content
}

export function localizedPublicServices(content, locale = 'zh-CN') {
  return content?.locales?.[locale] || content?.locales?.[locale.startsWith('en') ? 'en-US' : 'zh-CN'] || null
}

export async function readPublicServiceContent() {
  const { data } = await axios.get('/enterprise-assets/site/service-pages.json', { timeout: 8000 })
  return validatePublicServiceContent(data)
}
