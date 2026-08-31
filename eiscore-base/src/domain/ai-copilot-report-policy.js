// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const AI_SMART_BI_REPORT_SECTIONS = [
  { key: 'summary', label: '摘要', aliases: ['摘要', '经营摘要', '分析摘要', '核心摘要', '结论', '总览'] },
  { key: 'metrics', label: '关键指标', aliases: ['关键指标', '核心指标', '指标口径'] },
  { key: 'charts', label: '指标图表', aliases: ['指标图表', '图表', '图表分析', '数据图表'] },
  { key: 'risks', label: '风险提醒', aliases: ['风险提醒', '风险', '风险预警', '异常提醒'] },
  { key: 'actions', label: '行动建议', aliases: ['行动建议', '建议', '改善建议', '下一步'] }
]

const REPORT_FILLER_LINE_RE = /^(好的|当然|收到|已收到|明白|了解|下面|以下|我将|我会|请查看|这里是|先给出|先汇总).{0,120}(智能\s*BI|经营分析|经营报告|分析报告|报告|图表|洞察|结论)/
const REPORT_FILLER_SENTENCE_RE = /(好的|当然|收到|已收到|明白|了解)[，,。！!\s].{0,100}(智能\s*BI|经营分析|经营报告|分析报告|报告)/

export const normalizeAiSmartBiHeading = (value = '') => String(value || '')
  .replace(/^#+\s*/, '')
  .replace(/^(第)?[一二三四五六七八九十\d]+[、.．\-\s]*/, '')
  .replace(/^第[一二三四五六七八九十\d]+部分/, '')
  .replace(/[：:]/g, '')
  .replace(/[【】\[\]（）()]/g, '')
  .replace(/\s+/g, '')
  .trim()

export const matchAiSmartBiReportSection = (text = '') => {
  const normalized = normalizeAiSmartBiHeading(text)
  if (!normalized) return null
  return AI_SMART_BI_REPORT_SECTIONS.find((section) => (
    section.aliases.some((alias) => {
      const normalizedAlias = normalizeAiSmartBiHeading(alias)
      return normalized === normalizedAlias || normalized.startsWith(normalizedAlias)
    })
  )) || null
}

export const shouldAiShowReportDownload = (
  message,
  { enterprise = false, streaming = false } = {}
) => {
  if (!enterprise || message?.role !== 'assistant' || streaming) return false
  return Boolean(String(message?.content || '').trim())
}

export const normalizeAiReportInlineText = (value) => String(value || '').replace(/\s+/g, ' ').trim()

export const isAiReportFillerLine = (text) => {
  const value = normalizeAiReportInlineText(text)
  if (!value) return false
  return REPORT_FILLER_LINE_RE.test(value) || REPORT_FILLER_SENTENCE_RE.test(value)
}

export const cleanAiReportFillerSentence = (text) => {
  const value = normalizeAiReportInlineText(text)
  if (!REPORT_FILLER_SENTENCE_RE.test(value)) return null
  return normalizeAiReportInlineText(value.replace(REPORT_FILLER_SENTENCE_RE, ''))
}

export const buildAiReportPrintDocument = (html) => `<!DOCTYPE html>
    <html>
      <head>
        <title>智能 BI 报告</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; color: #303133; }
          .report-content { background: #fff; }
          .markdown-body p { margin: 0 0 8px; line-height: 1.7; }
          .markdown-body pre { background: #f5f7fa; padding: 10px; border-radius: 6px; overflow: auto; }
          .markdown-body table { width: 100%; border-collapse: collapse; margin: 8px 0; }
          .markdown-body th, .markdown-body td { border: 1px solid #ebeef5; padding: 6px 8px; text-align: left; }
          .mermaid-chart svg { max-width: 100%; height: auto; }
        </style>
      </head>
      <body>
        <h2>智能 BI 报告</h2>
        <div class="report-content">${html}</div>
      </body>
    </html>`
