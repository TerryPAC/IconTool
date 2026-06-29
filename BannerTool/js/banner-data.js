import { deepClone, scaleInt } from './utils.js';

function s8ToNormal(s8Items) {
  return s8Items.map((item) => {
    const out = deepClone(item);
    if (out.top_margin != null) {
      out.top_margin = scaleInt(out.top_margin);
    }
    if (out.type === 'text') {
      if (out.size != null) out.size = scaleInt(out.size);
      if (out.line_height != null) out.line_height = scaleInt(out.line_height);
    } else if (out.type === 'line') {
      if (out.width != null) out.width = scaleInt(out.width);
    }
    return out;
  });
}

export function parseS8Text(raw) {
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.s8)) return parsed.s8;
  throw new Error('S8 须为 JSON 数组');
}

export function extractS8FromFullJson(raw) {
  const data = JSON.parse(raw);
  if (!Array.isArray(data.s8)) return null;
  return data.s8;
}

export function mergeBannerUpdate(fullData, s8Items) {
  const next = { ...fullData };
  next.s8 = deepClone(s8Items);
  next.ipad = deepClone(s8Items);
  next.normal = s8ToNormal(s8Items);
  return next;
}

export function parsePreviewInput(s8Raw, fullRaw) {
  let items;
  let bgColor = '#ffffff';

  const parsed = JSON.parse(s8Raw);
  if (Array.isArray(parsed)) {
    items = parsed;
  } else {
    items = parsed.s8 || parsed.normal || [];
    if (parsed.background?.color) bgColor = parsed.background.color;
  }

  if (fullRaw) {
    try {
      const full = JSON.parse(fullRaw);
      if (full.background?.color) bgColor = full.background.color;
    } catch {
      // 左侧 JSON 尚未就绪时忽略 background
    }
  }

  return { items, bgColor };
}
