import { logWarn } from './logger.js';

const fontCache = new Map();

// 由字体文件名生成唯一的家族别名（用于在 TypefaceFontProvider 中注册/引用），
// 保证每个字体文件 = 一个独立家族，避免同名家族下 Bold/Medium 等不同字重互相覆盖。
export function fontAlias(filename) {
  if (!filename) return 'Roboto';
  return filename.replace(/\.(ttf|otf)$/i, '').replace(/\s+/g, '');
}

// 从字体文件名解析出 family 名、weight 数值、slant 数值
export function parseFontName(filename) {
  if (!filename) return { family: 'Roboto', alias: 'Roboto', weight: 400, slant: 0 };
  const base = filename.replace(/\.(ttf|otf)$/i, '');
  const alias = base.replace(/\s+/g, '');
  const dash = base.lastIndexOf('-');
  if (dash === -1) return { family: base, alias, weight: 400, slant: 0 };

  const family = base.substring(0, dash).replace(/\s+/g, '');
  const suffix = base.substring(dash + 1);

  const isItalic = /italic/i.test(suffix);
  const weightKey = suffix.replace(/italic/i, '').trim().toLowerCase();

  const weightMap = {
    thin: 100,
    extralight: 200,
    light: 300,
    regular: 400,
    '': 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
    extbold: 800,
    black: 900,
  };

  return {
    family,
    alias,
    weight: weightMap[weightKey] ?? 400,
    slant: isItalic ? 1 : 0,
  };
}

export function collectFontNames(items) {
  const fontNames = new Set();
  items.forEach((item) => {
    if (item.font) fontNames.add(item.font);
    if (item.parts) item.parts.forEach((p) => { if (p.font) fontNames.add(p.font); });
  });
  return fontNames;
}

async function fetchFont(name) {
  if (!name) return null;
  if (fontCache.has(name)) return fontCache.get(name);
  try {
    const resp = await fetch(`fonts/${name}`);
    if (!resp.ok) throw new Error('Font not found');
    const buffer = await resp.arrayBuffer();
    fontCache.set(name, buffer);
    return buffer;
  } catch (e) {
    logWarn(`字体加载失败: ${name}`, e);
    return null;
  }
}

export async function loadFontsForItems(CK, items) {
  const fontNames = collectFontNames(items);
  const fontEntries = await Promise.all(
    Array.from(fontNames).map(async (name) => ({ name, buffer: await fetchFont(name) })),
  );

  const fontMgr = CK.TypefaceFontProvider.Make();
  fontEntries.forEach(({ name, buffer }) => {
    if (buffer) fontMgr.registerFont(buffer, fontAlias(name));
  });

  return fontMgr;
}
