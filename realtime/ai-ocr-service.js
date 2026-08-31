// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

'use strict';

const createAiOcrService = ({
  getAiVisionConfig,
  callAiVisionUpstreamWithRetry,
  normalizeText,
  cleanModelText,
  extractCompletionText,
  maxImages = 6
}) => {
  const extractImageUrlsFromMessages = (messages) => {
    const urls = [];
    if (!Array.isArray(messages)) return urls;
    for (const message of messages) {
      const content = message?.content;
      if (!Array.isArray(content)) continue;
      for (const part of content) {
        if (part?.type !== 'image_url') continue;
        const url = normalizeText(part?.image_url?.url || part?.url);
        if (url) urls.push(url);
      }
    }
    return urls;
  };

  const hasImageContent = (content) => {
    if (!Array.isArray(content)) return false;
    return content.some((part) => (
      part?.type === 'image_url' && normalizeText(part?.image_url?.url || part?.url)
    ));
  };

  const replaceImagesWithOcrText = (messages, ocrItems) => {
    if (!Array.isArray(messages) || !Array.isArray(ocrItems) || ocrItems.length === 0) return messages;
    let imageIndex = 0;
    return messages.map((message) => {
      if (!Array.isArray(message?.content) || !hasImageContent(message.content)) return message;
      const parts = [];
      for (const part of message.content) {
        if (part?.type === 'text') {
          const text = normalizeText(part?.text);
          if (text) parts.push(text);
          continue;
        }
        if (part?.type === 'image_url') {
          const item = ocrItems[imageIndex];
          imageIndex += 1;
          const text = normalizeText(item?.text);
          parts.push(text
            ? `【图片${imageIndex} OCR识别结果】\n${text}`
            : `【图片${imageIndex} OCR识别失败】${normalizeText(item?.error) || '未识别到文字'}`);
        }
      }
      const content = parts.filter(Boolean).join('\n\n').trim();
      return { ...message, content: content || normalizeText(message.content) };
    });
  };

  const runImageOcr = async (imageUrl, prompt = '') => {
    const cfg = await getAiVisionConfig();
    const ocrPrompt = normalizeText(prompt) ||
      normalizeText(cfg?.ocr_prompt) ||
      '请识别图片中的所有可见文字。只输出OCR文字内容，保持原有行顺序，不要解释。';
    const upstream = await callAiVisionUpstreamWithRetry({
      model: cfg?.model,
      stream: false,
      temperature: cfg?.temperature ?? 0,
      max_tokens: cfg?.ocr_max_tokens || cfg?.max_tokens || 1024,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: ocrPrompt },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        }
      ]
    }, { cfg }, { maxRetries: 1, baseDelayMs: 480 });

    if (!upstream.ok) {
      return {
        ok: false,
        status: upstream.status,
        error: upstream.payload?.detail || upstream.payload?.message || 'AI vision OCR failed'
      };
    }
    return {
      ok: true,
      model: upstream.config?.model || cfg?.model || '',
      text: cleanModelText(extractCompletionText(upstream.data))
    };
  };

  const enrichMessagesWithOcr = async (messages) => {
    const urls = extractImageUrlsFromMessages(messages).slice(0, maxImages);
    if (urls.length === 0) return { messages, ocr: [] };
    const ocr = [];
    for (const url of urls) {
      try {
        const result = await runImageOcr(url);
        ocr.push(result.ok
          ? { ok: true, text: result.text, model: result.model }
          : { ok: false, text: '', error: result.error, status: result.status });
      } catch (error) {
        ocr.push({ ok: false, text: '', error: error?.message || 'OCR failed' });
      }
    }
    return { messages: replaceImagesWithOcrText(messages, ocr), ocr };
  };

  return Object.freeze({
    enrichMessagesWithOcr,
    runImageOcr
  });
};

module.exports = {
  createAiOcrService
};
