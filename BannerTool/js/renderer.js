import { S8_WIDTH, RENDER_SCALE } from './constants.js';
import { logInfo, logError } from './logger.js';
import { setStatus, setStatusNeutral } from './ui.js';
import { parseFontName, loadFontsForItems } from './fonts.js';
import { parsePreviewInput } from './banner-data.js';

function buildParagraph(CK, item, fontMgr) {
  const fontSize = Number(item.size) || 0;
  const color = CK.parseColorString(item.color || '#000000');
  const spacing = Number(item.spacing) || 0;
  const lineH = Number(item.line_height) || 0;
  const maxLines = Number(item.lines) || 0;
  const { alias: itemAlias, weight: itemWeight, slant: itemSlant } = parseFontName(item.font);

  const strutStyle = (lineH > 0 && fontSize > 0) ? {
    strutEnabled: true,
    forceStrutHeight: false,
    fontSize,
    fontFamilies: [itemAlias, 'Roboto', 'sans-serif'],
    fontStyle: { weight: itemWeight, slant: itemSlant },
    leading: lineH / fontSize,
  } : null;

  const topAlignOffset = Array.isArray(item.parts) && item.parts.some((p) => p && p.align === 'top')
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
}

function measureBannerHeight(items, preBuilt) {
  let topPadding = 0;
  let bottomPadding = 0;
  if (items.length > 0) {
    topPadding = Number(items[0].top_padding) || 0;
    bottomPadding = Number(items[items.length - 1].bottom_padding) || 0;
  }

  let bannerHeight = topPadding + bottomPadding;
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

  return { topPadding, bannerHeight };
}

function deleteParagraphs(preBuilt) {
  preBuilt.forEach((entry) => {
    if (entry.kind === 'text' && entry.para) {
      try { entry.para.delete(); } catch (_) { /* ignore */ }
    }
  });
}

export function createRenderer(CK, elements) {
  const { canvas, emptyPlaceholder, deviceScreen } = elements;
  let fontMgr = null;

  return async function render(s8Raw, fullRaw) {
    const rawValue = s8Raw.trim();
    if (!rawValue) {
      canvas.style.display = 'none';
      emptyPlaceholder.style.display = 'flex';
      setStatusNeutral('等待 S8 JSON...');
      deviceScreen.style.backgroundColor = '#f0f0f0';
      return;
    }

    let items;
    let bgColor;
    try {
      ({ items, bgColor } = parsePreviewInput(rawValue, fullRaw?.trim() || ''));
    } catch (e) {
      setStatus('S8 JSON 语法错误', true);
      logError('S8 JSON 语法错误', e);
      return;
    }

    canvas.style.display = 'block';
    emptyPlaceholder.style.display = 'none';
    setStatusNeutral('正在渲染...');
    deviceScreen.style.backgroundColor = bgColor;

    if (fontMgr) fontMgr.delete();
    fontMgr = await loadFontsForItems(CK, items);

    const preBuilt = items.map((item) => {
      if (item.type === 'line') return { kind: 'line', item };
      return buildParagraph(CK, item, fontMgr);
    });

    const { topPadding, bannerHeight } = measureBannerHeight(items, preBuilt);

    canvas.width = S8_WIDTH;
    canvas.height = bannerHeight;
    canvas.style.width = '100%';
    canvas.style.height = 'auto';

    try {
      const surface = CK.MakeCanvasSurface(canvas);
      if (!surface) throw new Error('MakeCanvasSurface 返回 null');

      surface.drawOnce((skCanvas) => {
        const paint = new CK.Paint();
        paint.setColor(CK.parseColorString(bgColor));
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
      logInfo('预览渲染完成', { items: items.length, height: bannerHeight });
    } catch (e) {
      setStatus('渲染失败', true);
      logError('预览渲染失败', e);
      deleteParagraphs(preBuilt);
    }
  };
}
