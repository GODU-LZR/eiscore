'use strict';

const CAPABILITIES = Object.freeze({
  eiscore_multimodal_translate: 'translate',
  eiscore_multimodal_ocr: 'ocr',
  eiscore_multimodal_map_locate: 'map-locate'
});
const MAX_TEXT = 12000;
const MAX_PROMPT = 2000;
const MAX_IMAGE_REF = 4 * 1024 * 1024;

const text = (value, max = MAX_TEXT) => String(value ?? '').trim().slice(0, max);
const reject = (message, code = 'HARNESS_MULTIMODAL_INVALID') => {
  const error = new Error(message);
  error.code = code;
  error.httpStatus = 400;
  throw error;
};

const imageRef = (value) => {
  const valueText = text(value, MAX_IMAGE_REF);
  if (!valueText || (!/^https?:\/\/[^\s]+$/i.test(valueText) && !/^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i.test(valueText))) {
    reject('image_url must be an http(s) URL or supported image data URL');
  }
  return valueText;
};

const rejectUntrustedFields = (payload) => {
  const forbidden = ['api_key', 'api_url', 'authorization', 'jwt', 'token', 'tenant_id', 'user_id', 'sql', 'table', 'schema', 'model', 'provider'];
  if (forbidden.some((key) => Object.prototype.hasOwnProperty.call(payload, key))) reject('multimodal payload contains an unsupported authorization or model field');
};

const sanitizeMultimodalPayload = (capabilityId, input = {}) => {
  const kind = CAPABILITIES[capabilityId];
  if (!kind) return input && typeof input === 'object' ? input : {};
  const payload = input && typeof input === 'object' ? input : {};
  rejectUntrustedFields(payload);
  const prompt = text(payload.prompt, MAX_PROMPT);
  if (kind === 'translate') {
    const source = text(payload.text);
    if (!source) reject('text is required', 'TEXT_REQUIRED');
    return {
      capability_id: capabilityId,
      messages: [
        { role: 'system', content: prompt || 'You are a translation assistant. Return only the translated text.' },
        { role: 'user', content: source }
      ],
      stream: false
    };
  }
  const image = imageRef(payload.image_url || payload.imageUrl);
  if (kind === 'ocr') {
    return {
      capability_id: capabilityId,
      messages: [{ role: 'user', content: [
        { type: 'text', text: prompt || 'Read all visible text. Return only the OCR text in reading order.' },
        { type: 'image_url', image_url: { url: image } }
      ] }],
      stream: false
    };
  }
  const lat = payload.lat === undefined || payload.lat === null || payload.lat === '' ? null : Number(payload.lat);
  const lng = payload.lng === undefined || payload.lng === null || payload.lng === '' ? null : Number(payload.lng);
  if ((lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) || (lng !== null && (!Number.isFinite(lng) || lng < -180 || lng > 180))) reject('coordinates are invalid');
  const coordinateText = lat === null || lng === null ? '' : ` Coordinates: ${lng},${lat}.`;
  return {
    capability_id: capabilityId,
    messages: [{ role: 'user', content: [
      { type: 'text', text: `${prompt || 'Identify the nearest street-level location from this map image. Return only the location.'}${coordinateText}` },
      { type: 'image_url', image_url: { url: image } }
    ] }],
    stream: false
  };
};

const completionText = (data) => text(data?.text || data?.address || data?.output_text || data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || '');
const formatMultimodalResult = (capabilityId, data) => {
  const value = completionText(data);
  return capabilityId === 'eiscore_multimodal_map_locate' ? { address: value } : { text: value };
};

module.exports = { CAPABILITIES, formatMultimodalResult, sanitizeMultimodalPayload };
