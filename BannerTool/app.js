let CK = null;
let fontMgr = null;
const fontCache = new Map();
const S8_WIDTH = 1440;
const DISPLAY_WIDTH = 360;
const RENDER_SCALE = S8_WIDTH / DISPLAY_WIDTH;
const SCALE_TO_NORMAL = 0.8;

const canvas = document.getElementById('skCanvas');
const fullJsonEditor = document.getElementById('fullJsonEditor');
const s8Editor = document.getElementById('s8Editor');
const statusText = document.getElementById('statusText');
const emptyPlaceholder = document.getElementById('emptyPlaceholder');
const deviceScreen = document.getElementById('deviceScreen');

let syncingFromFull = false;

function scaleInt(value) {
  return Math.round(Number(value) * SCALE_TO_NORMAL);
}

// 从字体文件名解析出 family 名、weight 数值、slant 数值
// 例: "Montserrat-Bold.ttf"      → { family: 'Montserrat',      weight: 700, slant: 0 }
//     "RobotoCondensed-BoldItalic.ttf" → { family: 'RobotoCondensed', weight: 700, slant: 1 }
//     "Montserrat-SemiBold.otf"  → { family: 'Montserrat',      weight: 600, slant: 0 }
// 由字体文件名生成唯一的家族别名（用于在 TypefaceFontProvider 中注册/引用），
// 保证每个字体文件 = 一个独立家族，避免同名家族下 Bold/Medium 等不同字重互相覆盖。
// 例: "Montserrat-Bold.ttf" → "Montserrat-Bold"; "Montserrat-Medium.ttf" → "Montserrat-Medium"
function fontAlias(filename) {
  if (!filename) return 'Roboto';
  return filename.replace(/\.(ttf|otf)$/i, '').replace(/\s+/g, '');
}

function parseFontName(filename) {
  if (!filename) return { family: 'Roboto', alias: 'Roboto', weight: 400, slant: 0 };
  const base = filename.replace(/\.(ttf|otf)$/i, '');
  const alias = base.replace(/\s+/g, '');
  const dash = base.lastIndexOf('-');
  if (dash === -1) return { family: base, alias, weight: 400, slant: 0 };

  const family = base.substring(0, dash).replace(/\s+/g, '');
  const suffix = base.substring(dash + 1);

  // slant: 含 Italic 则为斜体 (1=Italic), 否则正体 (0=Upright)
  const isItalic = /italic/i.test(suffix);
  const weightKey = suffix.replace(/italic/i, '').trim().toLowerCase();

  const weightMap = {
    'thin':        100,
    'extralight':  200,
    'light':       300,
    'regular':     400,
    '':            400,
    'medium':      500,
    'semibold':    600,
    'bold':        700,
    'extrabold':   800,
    'extbold':     800,
    'black':       900,
  };

  return {
    family,
    alias,
    weight: weightMap[weightKey] ?? 400,
    slant: isItalic ? 1 : 0,
  };
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

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

function parseS8Editor() {
  const raw = s8Editor.value.trim();
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.s8)) return parsed.s8;
  throw new Error('S8 须为 JSON 数组');
}

function syncS8FromFull() {
  const raw = fullJsonEditor.value.trim();
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data.s8)) return;
    syncingFromFull = true;
    s8Editor.value = JSON.stringify(data.s8, null, 2);
    syncingFromFull = false;
    render();
  } catch (_) {
    /* 左侧 JSON 未就绪时不覆盖中间栏 */
  }
}

function applyUpdate() {
  const fullRaw = fullJsonEditor.value.trim();
  if (!fullRaw) {
    setStatus('请先在左侧粘贴完整 JSON', true);
    return;
  }

  let fullData;
  let s8Items;
  try {
    fullData = JSON.parse(fullRaw);
    s8Items = parseS8Editor();
    if (!s8Items) {
      setStatus('中间栏 S8 为空', true);
      return;
    }
  } catch (e) {
    setStatus('JSON 解析失败: ' + e.message, true);
    return;
  }

  fullData.s8 = deepClone(s8Items);
  fullData.ipad = deepClone(s8Items);
  fullData.normal = s8ToNormal(s8Items);

  fullJsonEditor.value = JSON.stringify(fullData, null, 2);
  setStatus('更新成功', false);
}

async function copyFullJson() {
  const text = fullJsonEditor.value;
  if (!text.trim()) {
    setStatus('当前无可复制内容', true);
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    setStatus('已复制完整 JSON', false);
  } catch (_) {
    fullJsonEditor.select();
    document.execCommand('copy');
    window.getSelection()?.removeAllRanges();
    setStatus('已复制完整 JSON', false);
  }
}

function setStatus(msg, isError) {
  statusText.textContent = msg;
  statusText.style.color = isError ? '#f7768e' : '#9ece6a';
}

async function init() {
  try {
    CK = await CanvasKitInit({
      locateFile: (file) => `https://unpkg.com/canvaskit-wasm@0.39.1/bin/full/${file}`
    });
    document.getElementById('loadingOverlay').style.display = 'none';
    fullJsonEditor.addEventListener('input', debounce(() => {
      syncS8FromFull();
    }, 300));
    s8Editor.addEventListener('input', debounce(() => {
      if (!syncingFromFull) render();
    }, 300));
  } catch (e) {
    console.error(e);
    document.getElementById('loadingText').textContent = '初始化失败: ' + e.message;
  }
}

async function getFont(name) {
  if (!name) return null;
  if (fontCache.has(name)) return fontCache.get(name);
  try {
    const resp = await fetch(`fonts/${name}`);
    if (!resp.ok) throw new Error('Font not found');
    const buffer = await resp.arrayBuffer();
    fontCache.set(name, buffer);
    return buffer;
  } catch (e) {
    console.warn(`无法加载字体: ${name}`, e);
    return null;
  }
}

async function render() {
  if (!CK) return;

  const rawValue = s8Editor.value.trim();
  if (!rawValue) {
    canvas.style.display = 'none';
    emptyPlaceholder.style.display = 'flex';
    statusText.textContent = '等待 S8 JSON...';
    statusText.style.color = '#565f89';
    deviceScreen.style.backgroundColor = '#f0f0f0';
    return;
  }

  let items;
  let bgColor = '#ffffff';
  try {
    const parsed = JSON.parse(rawValue);
    if (Array.isArray(parsed)) {
      items = parsed;
    } else {
      items = parsed.s8 || parsed.normal || [];
      if (parsed.background?.color) bgColor = parsed.background.color;
    }
    const fullRaw = fullJsonEditor.value.trim();
    if (fullRaw) {
      try {
        const full = JSON.parse(fullRaw);
        if (full.background?.color) bgColor = full.background.color;
      } catch (_) {}
    }
  } catch (e) {
    setStatus('S8 JSON 语法错误', true);
    return;
  }

  const data = { s8: items, background: { color: bgColor } };

  canvas.style.display = 'block';
  emptyPlaceholder.style.display = 'none';
  statusText.textContent = '正在渲染...';
  statusText.style.color = '#565f89';

  deviceScreen.style.backgroundColor = bgColor;

  const fontNames = new Set();
  items.forEach((item) => {
    if (item.font) fontNames.add(item.font);
    if (item.parts) item.parts.forEach((p) => { if (p.font) fontNames.add(p.font); });
  });

  const fontEntries = await Promise.all(
    Array.from(fontNames).map(async (name) => ({ name, buffer: await getFont(name) }))
  );

  if (fontMgr) fontMgr.delete();
  // 用 TypefaceFontProvider 把每个字体文件注册为唯一家族别名，
  // 不再依赖 Skia 在同名家族下按 weight 匹配（那会导致 Bold/Medium 互相覆盖）。
  fontMgr = CK.TypefaceFontProvider.Make();
  fontEntries.forEach(({ name, buffer }) => {
    if (buffer) fontMgr.registerFont(buffer, fontAlias(name));
  });

  // Extract topPadding / bottomPadding from first / last items
  let topPadding = 0;
  let bottomPadding = 0;
  if (items.length > 0) {
    topPadding = Number(items[0].top_padding) || 0;
    bottomPadding = Number(items[items.length - 1].bottom_padding) || 0;
  }
  let bannerHeight = 0;

  // Pre-pass: build all paragraphs and measure actual heights
  const preBuilt = items.map((item) => {
    if (item.type === 'line') {
      return { kind: 'line', item };
    }
    const fontSize = Number(item.size) || 0;
    const color = CK.parseColorString(item.color || '#000000');
    const spacing = Number(item.spacing) || 0;
    const lineH = Number(item.line_height) || 0;
    const maxLines = Number(item.lines) || 0;
    const { alias: itemAlias, weight: itemWeight, slant: itemSlant } = parseFontName(item.font);

    // strutStyle.leading (em) maps Android setLineSpacing(extra, 1f) per-line spacing
    const strutStyle = (lineH > 0 && fontSize > 0) ? {
      strutEnabled: true,
      forceStrutHeight: false,
      fontSize,
      fontFamilies: [itemAlias, 'Roboto', 'sans-serif'],
      fontStyle: { weight: itemWeight, slant: itemSlant },
      leading: lineH / fontSize,
    } : null;

    // parts with align:"top" get Android dp2px(3f) topMargin; approximate by shifting whole paragraph
    const topAlignOffset = Array.isArray(item.parts) && item.parts.some(p => p && p.align === 'top')
      ? 3 * RENDER_SCALE : 0;

    const paraStyle = new CK.ParagraphStyle({
      textStyle: {
        color,
        fontSize,
        fontFamilies: [itemAlias, 'Roboto', 'sans-serif'],
        fontStyle: { weight: itemWeight, slant: itemSlant },
        letterSpacing: spacing * fontSize,
      },
      textAlign: CK.TextAlign.Center,
      ...(maxLines > 0 ? { maxLines } : {}),
      ...(strutStyle ? { strutStyle } : {}),
    });

    const builder = CK.ParagraphBuilder.MakeFromFontProvider(paraStyle, fontMgr);
    if (item.parts && item.parts.length > 0) {
      item.parts.forEach((p) => {
        const range = p.text_range || {};
        const sub = (item.content || '').substring(range.start || 0, (range.start || 0) + (range.length || 0));
        const pSize = Number(p.size) || Number(item.size) || 0;
        const { alias: pAlias, weight: pWeight, slant: pSlant } = parseFontName(p.font || item.font);
        builder.pushStyle(new CK.TextStyle({
          color: CK.parseColorString(p.color || item.color || '#000000'),
          fontSize: pSize,
          fontFamilies: [pAlias, 'Roboto', 'sans-serif'],
          fontStyle: { weight: pWeight, slant: pSlant },
          letterSpacing: (Number(p.spacing ?? item.spacing) || 0) * pSize,
        }));
        builder.addText(sub);
        builder.pop();
      });
    } else {
      builder.pushStyle(new CK.TextStyle({
        color,
        fontSize,
        fontFamilies: [itemAlias, 'Roboto', 'sans-serif'],
        fontStyle: { weight: itemWeight, slant: itemSlant },
        letterSpacing: spacing * fontSize,
      }));
      builder.addText(item.content || '');
      builder.pop();
    }

    const para = builder.build();
    para.layout(S8_WIDTH);
    builder.delete();
    return { kind: 'text', item, para, topAlignOffset };
  });

  // Recalculate bannerHeight using actual paragraph heights
  bannerHeight = topPadding + bottomPadding;
  preBuilt.forEach((entry) => {
    const topMargin = Number(entry.item.top_margin) || 0;
    bannerHeight += topMargin;
    if (entry.kind === 'line') {
      bannerHeight += Math.max(RENDER_SCALE, (parseFloat(entry.item.height) || 1) * RENDER_SCALE);
    } else {
      bannerHeight += entry.para.getHeight();
    }
    const bottomMargin = Number(entry.item.bottom_margin) || 0;
    bannerHeight += bottomMargin;
  });

  canvas.width = S8_WIDTH;
  canvas.height = bannerHeight;
  canvas.style.width = '100%';
  canvas.style.height = 'auto';

  const surface = CK.MakeCanvasSurface(canvas);
  surface.drawOnce((skCanvas) => {

    const bg = data.background?.color || '#ffffff';
    const paint = new CK.Paint();
    paint.setColor(CK.parseColorString(bg));
    skCanvas.drawRect(CK.LTRBRect(0, 0, S8_WIDTH, bannerHeight), paint);

    let currentY = topPadding;

    preBuilt.forEach((entry) => {
      const topMargin = Number(entry.item.top_margin) || 0;
      currentY += topMargin;

      if (entry.kind === 'line') {
        const w = Number(entry.item.width) || 0;
        const h = Math.max(RENDER_SCALE, (parseFloat(entry.item.height) || 1) * RENDER_SCALE);
        const x = (S8_WIDTH - w) / 2;
        paint.setColor(CK.parseColorString(entry.item.color || '#000000'));
        skCanvas.drawRect(CK.LTRBRect(x, currentY, x + w, currentY + h), paint);
        currentY += h;
      } else {
        skCanvas.drawParagraph(entry.para, 0, currentY + (entry.topAlignOffset || 0));
        currentY += entry.para.getHeight();
        entry.para.delete();
      }
      const bottomMargin = Number(entry.item.bottom_margin) || 0;
      currentY += bottomMargin;
    });
    paint.delete();
  });

  setStatus('渲染完成', false);
}

function debounce(fn, ms) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), ms);
  };
}

init();