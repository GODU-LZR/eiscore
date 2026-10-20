// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const INQUIRY_ENDPOINT = '/company-site/public/leads'
const SUBMIT_ERROR = '需求提交失败，请稍后重试。'

export async function submitHuizhongInquiry(form, {
  fetchImpl = globalThis.fetch,
  pagePath = globalThis.location?.pathname || '/company-site/huizhong'
} = {}) {
  const contactName = String(form.name || '').trim()
  const email = String(form.email || '').trim()
  const message = String(form.message || '').trim()
  const space = String(form.space || '').trim()
  if (!contactName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !message) {
    throw new Error('请填写联系人、有效邮箱和需求说明。')
  }
  if (!form.consent) throw new Error('请先同意我们使用所填信息联系您。')

  let response
  try {
    response = await fetchImpl(INQUIRY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        contactName,
        email,
        message: `保护空间：${space}\n需求说明：${message}`,
        consent: { accepted: true },
        source: 'website',
        locale: 'zh-CN',
        pagePath
      })
    })
  } catch {
    throw new Error('暂时无法连接服务，请检查网络后重试。')
  }
  const data = await response.json().catch(() => null)
  if (!response.ok || data?.ok !== true || !data?.lead?.publicRef) {
    throw new Error(response.status === 429 ? '提交过于频繁，请稍后重试。' : SUBMIT_ERROR)
  }
  return data.lead
}
