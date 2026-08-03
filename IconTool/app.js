/**
 * 图片取色与颜色替换 — 纯前端实现（位图 Canvas + SVG 源码双路径，支持多图批量）
 */
(function () {
  "use strict";

  const fileInput = document.getElementById("fileInput");
  const uploadZone = document.getElementById("uploadZone");
  const uploadHint = document.getElementById("uploadHint");
  const imagesGridWrap = document.getElementById("imagesGridWrap");
  const imagesGrid = document.getElementById("imagesGrid");
  const globalPlaceholder = document.getElementById("globalPlaceholder");

  const btnDrawRect = document.getElementById("btnDrawRect");
  const btnClearRect = document.getElementById("btnClearRect");
  const rectStatus = document.getElementById("rectStatus");
  const modeHint = document.getElementById("modeHint");

  const pickedSwatch = document.getElementById("pickedSwatch");
  const pickedHex = document.getElementById("pickedHex");
  const pickedRgb = document.getElementById("pickedRgb");
  const toleranceEl = document.getElementById("tolerance");
  const toleranceValue = document.getElementById("toleranceValue");
  const selectionStats = document.getElementById("selectionStats");
  const btnCancelPick = document.getElementById("btnCancelPick");

  const replaceColor = document.getElementById("replaceColor");
  const hexTextInput = document.getElementById("hexTextInput");
  const rInput = document.getElementById("rInput");
  const gInput = document.getElementById("gInput");
  const bInput = document.getElementById("bInput");
  const btnReplace = document.getElementById("btnReplace");
  const btnDownload = document.getElementById("btnDownload");
  const panelEl = document.querySelector(".panel");
  const previewEl = document.querySelector(".preview");

  /** @type {{ r: number; g: number; b: number } | null} */
  let pickedColor = null;

  let idCounter = 0;
  function nextId() {
    return "img-" + ++idCounter;
  }

  /**
   * @typedef {{ x: number; y: number; w: number; h: number }} Rect
   * @typedef {{
   *   id: string;
   *   file: File;
   *   kind: 'raster' | 'svg';
   *   svgText: string | null;
   *   previewImg: HTMLImageElement | null;
   *   highlightImg: HTMLImageElement | null;
   *   svgPreviewUrl: string | null;
   *   svgHighlightUrl: string | null;
   *   card: HTMLElement;
   *   wrap: HTMLElement;
   *   imageCanvas: HTMLCanvasElement;
   *   rectCanvas: HTMLCanvasElement;
   *   overlayCanvas: HTMLCanvasElement;
   *   ictx: CanvasRenderingContext2D;
   *   rctx: CanvasRenderingContext2D;
   *   octx: CanvasRenderingContext2D;
   *   rects: Rect[];
   *   selectionMask: Uint8Array | null;
   *   selectionCount: number;
   *   frozenMask: Uint8Array | null;
   *   frozenCount: number;
   *   width: number;
   *   height: number;
   * }} ImageItem
   */

  const SVG_COLOR_ATTRS = [
    "fill",
    "stroke",
    "stop-color",
    "flood-color",
    "lighting-color",
    "color",
  ];
  const SVG_COLOR_PROPS = new Set(SVG_COLOR_ATTRS);
  const _colorProbe = document.createElement("canvas").getContext("2d");

  function isSvgFile(file) {
    return (
      file.type === "image/svg+xml" ||
      (!file.type && /\.svg$/i.test(file.name)) ||
      /\.svg$/i.test(file.name)
    );
  }

  function isAcceptableImageFile(file) {
    if (isSvgFile(file)) return true;
    return !!(file.type && file.type.startsWith("image/"));
  }

  /** @param {string} str @returns {{ r: number; g: number; b: number } | null} */
  function parseCssColor(str) {
    if (!str) return null;
    const s = str.trim();
    if (!s) return null;
    const lower = s.toLowerCase();
    if (
      lower === "none" ||
      lower === "transparent" ||
      lower === "currentcolor" ||
      lower === "inherit" ||
      lower === "initial" ||
      lower === "unset"
    ) {
      return null;
    }
    if (/^url\(/i.test(s)) return null;

    _colorProbe.fillStyle = "#01fe03";
    _colorProbe.fillStyle = s;
    const out = _colorProbe.fillStyle;
    if (out === "#01fe03") {
      if (lower !== "#01fe03" && lower !== "#01FE03") return null;
    }

    const hex = /^#([0-9a-f]{6})$/i.exec(out);
    if (hex) {
      const n = parseInt(hex[1], 16);
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }
    const rgb = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i.exec(out);
    if (rgb) {
      return {
        r: Math.round(Number(rgb[1])),
        g: Math.round(Number(rgb[2])),
        b: Math.round(Number(rgb[3])),
      };
    }
    return null;
  }

  function colorDistSq(a, b) {
    const dr = a.r - b.r;
    const dg = a.g - b.g;
    const db = a.b - b.b;
    return dr * dr + dg * dg + db * db;
  }

  function formatSvgColor(r, g, b) {
    return (
      "#" +
      [r, g, b]
        .map((v) => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, "0"))
        .join("")
    );
  }

  /** @param {string} style */
  function parseStylePairs(style) {
    /** @type {{ prop: string; value: string }[]} */
    const pairs = [];
    for (const part of style.split(";")) {
      const idx = part.indexOf(":");
      if (idx < 0) continue;
      const prop = part.slice(0, idx).trim().toLowerCase();
      const value = part.slice(idx + 1).trim();
      if (prop && value) pairs.push({ prop, value });
    }
    return pairs;
  }

  /** @param {string} style @param {string} prop @param {string} newValue */
  function replaceStyleProp(style, prop, newValue) {
    const parts = style.split(";");
    let found = false;
    const out = parts.map((part) => {
      const idx = part.indexOf(":");
      if (idx < 0) return part;
      const p = part.slice(0, idx).trim().toLowerCase();
      if (p !== prop) return part;
      found = true;
      const ws = part.slice(0, idx).match(/^\s*/)[0];
      return `${ws}${part.slice(0, idx).trim()}: ${newValue}`;
    });
    if (!found) out.push(`${prop}: ${newValue}`);
    return out.join(";").replace(/;+$/, "");
  }

  /**
   * 从 `<style>` 文本中找出可解析的颜色片段（hex / rgb / rgba）
   * @param {string} css
   */
  function findCssColorSpans(css) {
    const re =
      /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b|rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(?:,\s*[\d.]+\s*)?\)/g;
    /** @type {{ value: string; start: number; end: number; rgb: { r: number; g: number; b: number } }[]} */
    const hits = [];
    let m;
    while ((m = re.exec(css))) {
      const rgb = parseCssColor(m[0]);
      if (!rgb) continue;
      hits.push({ value: m[0], start: m.index, end: m.index + m[0].length, rgb });
    }
    return hits;
  }

  /**
   * @param {string} svgText
   * @returns {{ svg: SVGSVGElement | null; sites: object[] }}
   */
  function collectSvgColorSites(svgText) {
    const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
    const svg = /** @type {SVGSVGElement | null} */ (doc.documentElement);
    if (!svg || svg.nodeName.toLowerCase() !== "svg" || svg.querySelector("parsererror")) {
      return { svg: null, sites: [] };
    }

    /** @type {object[]} */
    const sites = [];
    const nodes = [svg, ...Array.from(svg.querySelectorAll("*"))];

    for (const el of nodes) {
      if (el.tagName && el.tagName.toLowerCase() === "style") continue;

      for (const attr of SVG_COLOR_ATTRS) {
        if (!el.hasAttribute(attr)) continue;
        const value = el.getAttribute(attr);
        const rgb = parseCssColor(value);
        if (!rgb) continue;
        sites.push({ kind: "attr", el, attr, value, rgb });
      }

      if (el.hasAttribute("style")) {
        const style = el.getAttribute("style") || "";
        for (const { prop, value } of parseStylePairs(style)) {
          if (!SVG_COLOR_PROPS.has(prop)) continue;
          const rgb = parseCssColor(value);
          if (!rgb) continue;
          sites.push({ kind: "style", el, prop, value, rgb });
        }
      }
    }

    for (const styleEl of svg.querySelectorAll("style")) {
      const text = styleEl.textContent || "";
      for (const hit of findCssColorSpans(text)) {
        sites.push({
          kind: "css",
          el: styleEl,
          value: hit.value,
          rgb: hit.rgb,
          start: hit.start,
          end: hit.end,
        });
      }
    }

    return { svg, sites };
  }

  /** @param {SVGSVGElement} svg @param {number} w @param {number} h */
  function canvasPointToSvg(svg, w, h, bx, by) {
    let vx = 0;
    let vy = 0;
    let vw = w;
    let vh = h;
    if (svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width > 0) {
      const vb = svg.viewBox.baseVal;
      vx = vb.x;
      vy = vb.y;
      vw = vb.width;
      vh = vb.height;
    }
    return {
      x: vx + (bx / Math.max(1, w)) * vw,
      y: vy + (by / Math.max(1, h)) * vh,
    };
  }

  /** @param {SVGSVGElement} svg @param {DOMRect} bbox @param {number} w @param {number} h */
  function svgBBoxToCanvasRect(svg, bbox, w, h) {
    let vx = 0;
    let vy = 0;
    let vw = w;
    let vh = h;
    if (svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width > 0) {
      const vb = svg.viewBox.baseVal;
      vx = vb.x;
      vy = vb.y;
      vw = vb.width;
      vh = vb.height;
    }
    const sx = w / Math.max(1e-6, vw);
    const sy = h / Math.max(1e-6, vh);
    return {
      x: (bbox.x - vx) * sx,
      y: (bbox.y - vy) * sy,
      w: bbox.width * sx,
      h: bbox.height * sy,
    };
  }

  function rectsIntersect(a, b) {
    return !(
      a.x + a.w <= b.x ||
      b.x + b.w <= a.x ||
      a.y + a.h <= b.y ||
      b.y + b.h <= a.y
    );
  }

  /**
   * 将解析出的 SVG 临时挂到 DOM，以便 getBBox / isPointInFill
   * @template T
   * @param {SVGSVGElement} svg
   * @param {(svg: SVGSVGElement) => T} fn
   * @returns {T}
   */
  function withMountedSvg(svg, fn) {
    const wrap = document.createElement("div");
    wrap.setAttribute("aria-hidden", "true");
    wrap.style.cssText =
      "position:fixed;left:-10000px;top:0;width:0;height:0;overflow:hidden;pointer-events:none;opacity:0;";
    document.body.appendChild(wrap);
    wrap.appendChild(svg);
    try {
      return fn(svg);
    } finally {
      wrap.remove();
    }
  }

  /** @param {Element} el */
  function readElementPaintColor(el) {
    const style = el.getAttribute("style") || "";
    const pairs = parseStylePairs(style);
    for (const prop of ["fill", "stroke", "stop-color", "color"]) {
      const fromStyle = pairs.find((p) => p.prop === prop);
      if (fromStyle) {
        const rgb = parseCssColor(fromStyle.value);
        if (rgb) return rgb;
      }
      if (el.hasAttribute(prop)) {
        const rgb = parseCssColor(el.getAttribute(prop));
        if (rgb) return rgb;
      }
    }
    return null;
  }

  /**
   * @param {ImageItem} item
   * @param {number} bx
   * @param {number} by
   * @returns {{ r: number; g: number; b: number } | null}
   */
  function pickSvgColorAt(item, bx, by) {
    const { svg, sites } = collectSvgColorSites(item.svgText || "");
    if (!svg || !sites.length) return null;

    const hit = withMountedSvg(svg, (mounted) => {
      const pt = canvasPointToSvg(mounted, item.width, item.height, bx, by);
      const svgPt = mounted.createSVGPoint();
      svgPt.x = pt.x;
      svgPt.y = pt.y;
      const candidates = Array.from(mounted.querySelectorAll("*")).reverse();
      for (const el of candidates) {
        try {
          const geo = /** @type {SVGGeometryElement} */ (el);
          const inFill = typeof geo.isPointInFill === "function" && geo.isPointInFill(svgPt);
          const inStroke =
            typeof geo.isPointInStroke === "function" && geo.isPointInStroke(svgPt);
          if (inFill || inStroke) {
            const c = readElementPaintColor(el);
            if (c) return c;
          }
        } catch (_) {}
      }
      return null;
    });
    if (hit) return hit;

    // 回退：预览像素最近的 SVG 颜色（保证取到的是源码中的色）
    const d = item.ictx.getImageData(bx, by, 1, 1).data;
    if (d[3] < 10) return sites[0].rgb;
    const sample = { r: d[0], g: d[1], b: d[2] };
    let best = sites[0].rgb;
    let bestDist = Infinity;
    for (const s of sites) {
      const dist = colorDistSq(s.rgb, sample);
      if (dist < bestDist) {
        bestDist = dist;
        best = s.rgb;
      }
    }
    return { r: best.r, g: best.g, b: best.b };
  }

  /** @param {ImageItem} item @param {object} site @param {SVGSVGElement} svg */
  function svgSiteInRects(item, site, svg) {
    if (!item.rects.length) return true;
    if (site.kind === "css") return true;
    try {
      const el = /** @type {SVGGraphicsElement} */ (site.el);
      if (typeof el.getBBox !== "function") return true;
      const bbox = el.getBBox();
      const r = svgBBoxToCanvasRect(svg, bbox, item.width, item.height);
      for (const rect of item.rects) {
        if (rectsIntersect(r, rect)) return true;
      }
      return false;
    } catch (_) {
      return true;
    }
  }

  /** @param {object[]} sites @param {(index: number) => string | null} getColor */
  function applySvgColorSites(sites, getColor) {
    const cssJobs = [];
    for (let i = 0; i < sites.length; i++) {
      const hex = getColor(i);
      if (hex == null) continue;
      const site = sites[i];
      if (site.kind === "attr") {
        site.el.setAttribute(site.attr, hex);
      } else if (site.kind === "style") {
        const style = site.el.getAttribute("style") || "";
        site.el.setAttribute("style", replaceStyleProp(style, site.prop, hex));
      } else if (site.kind === "css") {
        cssJobs.push({ site, hex });
      }
    }
    cssJobs.sort((a, b) => b.site.start - a.site.start);
    for (const { site, hex } of cssJobs) {
      const text = site.el.textContent || "";
      site.el.textContent = text.slice(0, site.start) + hex + text.slice(site.end);
    }
  }

  function getToleranceMaxDistSq() {
    const t = Number(toleranceEl.value);
    const maxDist = (t / 100) * 441;
    return maxDist * maxDist;
  }

  /** 位图式高亮预览（透明底 + 粉色匹配像素） */
  function paintRasterHighlight(item, mask, w, h) {
    if (!mask) return;
    const hi = item.octx.createImageData(w, h);
    const hd = hi.data;
    for (let i = 0; i < mask.length; i++) {
      if (!mask[i]) continue;
      const oi = i * 4;
      hd[oi] = HIGHLIGHT.r;
      hd[oi + 1] = HIGHLIGHT.g;
      hd[oi + 2] = HIGHLIGHT.b;
      hd[oi + 3] = HIGHLIGHT.a;
    }
    item.octx.putImageData(hi, 0, 0);
  }

  /** @param {ImageItem} item */
  function refreshSelectionForSvgItem(item) {
    const { svg, sites } = collectSvgColorSites(item.svgText || "");
    if (!svg || !sites.length) return;

    const maxDistSq = getToleranceMaxDistSq();
    const mask = new Uint8Array(sites.length);

    withMountedSvg(svg, (mounted) => {
      for (let i = 0; i < sites.length; i++) {
        const site = sites[i];
        if (colorDistSq(site.rgb, pickedColor) > maxDistSq) continue;
        if (!svgSiteInRects(item, site, mounted)) continue;
        mask[i] = 1;
        item.selectionCount++;
      }
    });

    item.selectionMask = mask;
    if (item.selectionCount === 0) {
      setSvgHighlight(item, null);
      return;
    }

    const hiText = buildSvgHighlightText(item.svgText || "", mask);
    setSvgHighlight(item, hiText);
  }

  /** @param {ImageItem} item */
  function refreshSelectionForRasterItem(item) {
    const w = item.width;
    const h = item.height;
    const imgData = item.ictx.getImageData(0, 0, w, h);
    const d = imgData.data;
    const mask = new Uint8Array(w * h);
    const maxDistSq = getToleranceMaxDistSq();

    const pr = pickedColor.r;
    const pg = pickedColor.g;
    const pb = pickedColor.b;

    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        if (!isInAnyRect(item, px, py)) continue;
        const i = (py * w + px) * 4;
        const dr = d[i] - pr;
        const dg = d[i + 1] - pg;
        const db = d[i + 2] - pb;
        const distSq = dr * dr + dg * dg + db * db;
        if (distSq <= maxDistSq) {
          const mi = py * w + px;
          mask[mi] = 1;
          item.selectionCount++;
        }
      }
    }

    item.selectionMask = mask;
    if (item.selectionCount === 0) return;
    paintRasterHighlight(item, mask, w, h);
  }

  function serializeSvg(svg) {
    if (!svg.getAttribute("xmlns")) {
      svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    }
    return new XMLSerializer().serializeToString(svg);
  }

  const EMPTY_SVG_DATA_URI =
    "data:image/svg+xml," +
    encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>');

  /** @param {ImageItem} item @param {'svgPreviewUrl'|'svgHighlightUrl'} key */
  function revokeSvgUrl(item, key) {
    if (item[key]) {
      URL.revokeObjectURL(item[key]);
      item[key] = null;
    }
  }

  /** @param {ImageItem} item @param {string} svgText */
  function setSvgPreview(item, svgText) {
    if (!item.previewImg) return;
    const oldUrl = item.svgPreviewUrl;
    item.svgPreviewUrl = null;
    const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    item.svgPreviewUrl = url;
    // 先换新 src，再释放旧 blob，避免 img 仍引用已 revoke 的 URL 出现破碎图标
    item.previewImg.src = url;
    if (oldUrl) URL.revokeObjectURL(oldUrl);
  }

  /**
   * 生成仅含匹配色的高亮 SVG（其余填色清空），保持矢量预览
   * @param {string} svgText
   * @param {Uint8Array} mask
   * @returns {string | null}
   */
  function buildSvgHighlightText(svgText, mask) {
    const { svg, sites } = collectSvgColorSites(svgText);
    if (!svg || sites.length !== mask.length) return null;

    const skip = new Set([
      "defs",
      "style",
      "script",
      "title",
      "desc",
      "metadata",
      "clippath",
      "mask",
      "filter",
      "lineargradient",
      "radialgradient",
      "stop",
      "pattern",
      "marker",
      "symbol",
    ]);
    for (const el of [svg, ...Array.from(svg.querySelectorAll("*"))]) {
      const tag = el.tagName.toLowerCase();
      if (skip.has(tag)) continue;
      const fillAttr = el.getAttribute("fill") || "";
      // 保留渐变引用，靠 stop-color 高亮；纯色则清空
      if (!/^url\(/i.test(fillAttr)) el.setAttribute("fill", "none");
      const strokeAttr = el.getAttribute("stroke") || "";
      if (!/^url\(/i.test(strokeAttr)) el.setAttribute("stroke", "none");
      if (el.hasAttribute("style")) {
        let style = el.getAttribute("style") || "";
        const pairs = parseStylePairs(style);
        const fillPair = pairs.find((p) => p.prop === "fill");
        const strokePair = pairs.find((p) => p.prop === "stroke");
        if (!fillPair || !/^url\(/i.test(fillPair.value)) {
          style = replaceStyleProp(style, "fill", "none");
        }
        if (!strokePair || !/^url\(/i.test(strokePair.value)) {
          style = replaceStyleProp(style, "stroke", "none");
        }
        el.setAttribute("style", style);
      }
    }

    const hi = `rgb(${HIGHLIGHT.r},${HIGHLIGHT.g},${HIGHLIGHT.b})`;
    applySvgColorSites(sites, (i) => {
      if (mask[i]) return hi;
      const s = sites[i];
      if (s.attr === "stop-color" || s.prop === "stop-color") return "transparent";
      return null;
    });
    return serializeSvg(svg);
  }

  /** @param {ImageItem} item @param {string | null} highlightSvgText */
  function setSvgHighlight(item, highlightSvgText) {
    if (!item.highlightImg) return;
    const oldUrl = item.svgHighlightUrl;
    item.svgHighlightUrl = null;
    if (!highlightSvgText) {
      item.highlightImg.hidden = true;
      // 不要 removeAttribute('src')：无 src 的 img 会显示破碎图标
      item.highlightImg.src = EMPTY_SVG_DATA_URI;
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      return;
    }
    const blob = new Blob([highlightSvgText], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    item.svgHighlightUrl = url;
    item.highlightImg.src = url;
    item.highlightImg.hidden = false;
    if (oldUrl) URL.revokeObjectURL(oldUrl);
  }

  /**
   * @param {string} svgText
   * @param {number} w
   * @param {number} h
   * @param {CanvasRenderingContext2D} ctx
   * @returns {Promise<void>}
   */
  function drawSvgTextToContext(svgText, w, h, ctx) {
    return new Promise((resolve, reject) => {
      const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
      const root = doc.documentElement;
      if (!root || root.nodeName.toLowerCase() !== "svg") {
        reject(new Error("invalid svg"));
        return;
      }
      if (!root.getAttribute("width")) root.setAttribute("width", String(w));
      if (!root.getAttribute("height")) root.setAttribute("height", String(h));
      const sized = serializeSvg(root);
      const blob = new Blob([sized], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve();
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("svg draw failed"));
      };
      img.src = url;
    });
  }

  function getSvgNaturalSize(svg, svgText) {
    if (svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width > 0) {
      return {
        w: Math.max(1, Math.round(svg.viewBox.baseVal.width)),
        h: Math.max(1, Math.round(svg.viewBox.baseVal.height)),
      };
    }
    const wAttr = parseFloat(svg.getAttribute("width") || "");
    const hAttr = parseFloat(svg.getAttribute("height") || "");
    if (wAttr > 0 && hAttr > 0) {
      return { w: Math.round(wAttr), h: Math.round(hAttr) };
    }
    // 最后回退：用 Image 探测
    return null;
  }

  /** @type {ImageItem[]} */
  let images = [];
  /** @type {string | null} */
  let activeImageId = null;

  let rectDrawMode = false;
  let rectDragging = false;
  /** @type {ImageItem | null} */
  let rectDragItem = null;
  /** @type {{ x: number; y: number } | null} */
  let rectDragStart = null;
  /** @type {{ x: number; y: number } | null} */
  let rectDragCurrent = null;

  let ignorePickUntil = 0;

  const HIGHLIGHT = { r: 255, g: 0, b: 128, a: Math.round(0.45 * 255) };
  const MIN_RECT_SIZE = 3;
  function getActiveItem() {
    if (!activeImageId) return null;
    return images.find((i) => i.id === activeImageId) || null;
  }

  function setActiveImage(id) {
    if (id == null) {
      activeImageId = null;
      for (const item of images) {
        item.card.classList.remove("active");
      }
      updateRectUI();
      updateCursors();
      return;
    }
    if (!images.some((i) => i.id === id)) return;
    activeImageId = id;
    for (const item of images) {
      item.card.classList.toggle("active", item.id === id);
    }
    updateRectUI();
    updateCursors();
  }

  function updateGridClass() {
    const n = images.length;
    imagesGrid.classList.toggle("has-images", n > 0);
    imagesGrid.classList.toggle("grid-count-1", n === 1);
    imagesGrid.classList.toggle("grid-count-2", n === 2);
    imagesGrid.classList.toggle("grid-count-many", n >= 3);
    syncEmptyPreviewHeight();
  }

  /** 空状态：右侧预览区高度跟随左侧操作面板，避免撑满视口 */
  function syncEmptyPreviewHeight() {
    if (!panelEl || !previewEl) return;
    if (images.length > 0) {
      previewEl.style.removeProperty("min-height");
      return;
    }
    previewEl.style.minHeight = `${panelEl.offsetHeight}px`;
  }

  function updateRectUI(msg) {
    const active = getActiveItem();
    const hasRects = active && active.rects.length > 0;
    btnClearRect.disabled = !hasRects;
    if (msg) {
      rectStatus.textContent = msg;
    } else if (rectDrawMode) {
      rectStatus.textContent = "Drag to draw…";
    } else {
      const totalRects = images.reduce((sum, i) => sum + i.rects.length, 0);
      rectStatus.textContent = totalRects > 0 ? `${totalRects} region${totalRects > 1 ? "s" : ""}` : "";
    }
  }

  function updateCursors() {
    for (const item of images) {
      item.wrap.classList.remove("cursor-pick", "cursor-rect");
      if (rectDrawMode && item.id === activeImageId) {
        item.wrap.classList.add("cursor-rect");
      } else {
        item.wrap.classList.add("cursor-pick");
      }
    }
  }

  function clientToBitmap(item, clientX, clientY) {
    const rect = item.imageCanvas.getBoundingClientRect();
    const sx = item.imageCanvas.width / rect.width;
    const sy = item.imageCanvas.height / rect.height;
    let bx = Math.floor((clientX - rect.left) * sx);
    let by = Math.floor((clientY - rect.top) * sy);
    bx = Math.max(0, Math.min(item.imageCanvas.width - 1, bx));
    by = Math.max(0, Math.min(item.imageCanvas.height - 1, by));
    return { bx, by };
  }

  /** @param {ImageItem} item @param {number} px @param {number} py */
  function isInAnyRect(item, px, py) {
    if (!item.rects.length) return true;
    for (const r of item.rects) {
      if (px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h) return true;
    }
    return false;
  }

  function normalizeRect(x0, y0, x1, y1) {
    const x = Math.min(x0, x1);
    const y = Math.min(y0, y1);
    const w = Math.abs(x1 - x0);
    const h = Math.abs(y1 - y0);
    return { x, y, w, h };
  }

  /** @param {ImageItem} item */
  function clampRectToImage(item, rect) {
    let { x, y, w, h } = rect;
    const iw = item.width;
    const ih = item.height;
    x = Math.max(0, Math.min(x, iw - 1));
    y = Math.max(0, Math.min(y, ih - 1));
    w = Math.min(w, iw - x);
    h = Math.min(h, ih - y);
    return { x, y, w, h };
  }

  /** @param {ImageItem} item */
  function drawRectLayer(item) {
    const rctx = item.rctx;
    rctx.clearRect(0, 0, item.rectCanvas.width, item.rectCanvas.height);

    const drawOne = (rx, ry, rw, rh, preview) => {
      if (rw < 1 || rh < 1) return;
      rctx.save();
      rctx.fillStyle = preview ? "rgba(59, 158, 255, 0.08)" : "rgba(59, 158, 255, 0.12)";
      rctx.fillRect(rx, ry, rw, rh);
      rctx.strokeStyle = preview ? "rgba(120, 190, 255, 0.95)" : "rgba(59, 158, 255, 0.95)";
      rctx.lineWidth = 1;
      rctx.setLineDash([8, 6]);
      rctx.strokeRect(rx + 0.5, ry + 0.5, rw - 1, rh - 1);

      rctx.restore();
    };

    for (const r of item.rects) {
      if (r.w >= 1 && r.h >= 1) drawOne(r.x, r.y, r.w, r.h, false);
    }

    if (rectDragging && rectDragItem === item && rectDragStart && rectDragCurrent) {
      const n = normalizeRect(
        rectDragStart.x,
        rectDragStart.y,
        rectDragCurrent.x,
        rectDragCurrent.y
      );
      if (n.w >= 1 && n.h >= 1) drawOne(n.x, n.y, n.w, n.h, true);
    }

    // 拖拽中不重建按钮，避免频繁 DOM 操作
    if (!rectDragging) syncRectDeleteButtons(item);
  }

  /** @param {ImageItem} item */
  function syncRectDeleteButtons(item) {
    for (const btn of item._rectBtns) btn.remove();
    item._rectBtns = [];

    for (let idx = 0; idx < item.rects.length; idx++) {
      const r = item.rects[idx];
      const btn = document.createElement("button");
      btn.className = "btn-delete-rect";
      btn.title = "Delete region";
      btn.innerHTML = `<svg viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>`;

      // 中心定位在矩形右上角，使用百分比坐标转换
      btn.style.left = `${((r.x + r.w) / item.width) * 100}%`;
      btn.style.top = `${(r.y / item.height) * 100}%`;

      const capturedIdx = idx;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        item.rects.splice(capturedIdx, 1);
        drawRectLayer(item);
        updateRectUI();
        if (pickedColor) refreshAllHighlights();
      });

      item.wrap.appendChild(btn);
      item._rectBtns.push(btn);
    }
  }

  /** @param {ImageItem} item */
  function clearOverlayHighlight(item) {
    item.octx.clearRect(0, 0, item.overlayCanvas.width, item.overlayCanvas.height);
    if (item.kind === "svg") setSvgHighlight(item, null);
  }

  /** @param {ImageItem} item */
  function refreshSelectionForItem(item) {
    clearOverlayHighlight(item);
    item.selectionMask = null;
    item.selectionCount = 0;

    if (!pickedColor || item.width === 0 || item.height === 0) {
      return;
    }

    if (item.kind === "svg") {
      refreshSelectionForSvgItem(item);
    } else {
      refreshSelectionForRasterItem(item);
    }
  }

  function formatSelectionStats(total) {
    const hasSvg = images.some((i) => i.kind === "svg");
    const hasRaster = images.some((i) => i.kind === "raster");
    const unit = hasSvg && hasRaster ? "Matches" : hasSvg ? "Colors" : "Pixels";
    return `${unit}: ${total.toLocaleString()} · ${images.length} img`;
  }

  function refreshAllHighlights() {
    let total = 0;
    for (const item of images) {
      refreshSelectionForItem(item);
      total += item.selectionCount;
    }
    if (!pickedColor || images.length === 0) {
      selectionStats.textContent = "Pixels: —";
    } else {
      selectionStats.textContent = formatSelectionStats(total);
    }
    updateReplaceButton();
  }

  function updateReplaceButton() {
    if (!pickedColor || images.length === 0) {
      btnReplace.disabled = true;
      return;
    }
    const any = images.some((i) => i.selectionCount > 0 || i.frozenCount > 0);
    btnReplace.disabled = !any;
  }

  function updatePickedUI() {
    if (!pickedColor) {
      pickedSwatch.style.background = "";
      pickedHex.textContent = "None";
      pickedRgb.textContent = "—";
      btnReplace.disabled = true;
      btnCancelPick.style.display = "none";
      return;
    }
    const { r, g, b } = pickedColor;
    pickedSwatch.style.background = `rgb(${r},${g},${b})`;
    pickedHex.textContent =
      "#" +
      [r, g, b]
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase();
    pickedRgb.textContent = `RGB(${r}, ${g}, ${b})`;
    btnCancelPick.style.display = "inline-flex";
    updateReplaceButton();
  }

  /** @param {ImageItem} item */
  function pickAt(item, bx, by) {
    if (item.kind === "svg") {
      const c = pickSvgColorAt(item, bx, by);
      if (!c) {
        modeHint.textContent = "No editable colors in SVG";
        return;
      }
      pickedColor = c;
    } else {
      const d = item.ictx.getImageData(bx, by, 1, 1).data;
      pickedColor = { r: d[0], g: d[1], b: d[2] };
    }
    // 只清除当前被取色图的冻结选区；其他图的冻结选区保持不变，
    // 这样用户对不同图片做独立替换后，再修改目标色时所有图都能继续参与
    item.frozenMask = null;
    item.frozenCount = 0;
    updatePickedUI();
    for (const im of images) {
      drawRectLayer(im);
    }
    refreshAllHighlights();
  }

  /** @param {ImageItem} item */
  function onOverlayClick(item, e) {
    if (performance.now() < ignorePickUntil) return;
    if (rectDrawMode || rectDragging) return;
    if (!item.width) return;

    const { bx, by } = clientToBitmap(item, e.clientX, e.clientY);

    if (item.id !== activeImageId) {
      // 点击非活跃图片时只切换选中，不取色
      setActiveImage(item.id);
      return;
    }
    pickAt(item, bx, by);
  }

  /** @param {ImageItem} item */
  function onOverlayPointerDown(item, e) {
    if (!item.width) return;
    if (!rectDrawMode) return;
    if (item.id !== activeImageId) return;
    e.preventDefault();
    rectDragging = true;
    rectDragItem = item;
    const p = clientToBitmap(item, e.clientX, e.clientY);
    rectDragStart = { x: p.bx, y: p.by };
    rectDragCurrent = { ...rectDragStart };
    item.overlayCanvas.setPointerCapture(e.pointerId);
    drawRectLayer(item);
  }

  /** @param {ImageItem} item */
  function onOverlayPointerMove(item, e) {
    if (rectDragging && rectDragItem === item && rectDragStart) {
      const p = clientToBitmap(item, e.clientX, e.clientY);
      rectDragCurrent = { x: p.bx, y: p.by };
      drawRectLayer(item);
      return;
    }

  }

  /** @param {ImageItem} item */
  function onOverlayPointerUp(item, e) {
    if (!rectDragging || rectDragItem !== item) return;
    rectDragging = false;
    try {
      item.overlayCanvas.releasePointerCapture(e.pointerId);
    } catch (_) {}

    let committed = false;
    let dragDist = 0;
    if (rectDragStart && rectDragCurrent) {
      dragDist = Math.hypot(
        rectDragCurrent.x - rectDragStart.x,
        rectDragCurrent.y - rectDragStart.y
      );
    }

    let msg = "";
    if (rectDragStart && rectDragCurrent) {
      let n = normalizeRect(
        rectDragStart.x,
        rectDragStart.y,
        rectDragCurrent.x,
        rectDragCurrent.y
      );
      n = clampRectToImage(item, n);
      if (n.w >= MIN_RECT_SIZE && n.h >= MIN_RECT_SIZE) {
        item.rects.push(n);
        committed = true;
      } else {
        msg = "Too small";
      }
    }

    if (dragDist > 4) {
      ignorePickUntil = performance.now() + 350;
    }
    rectDragStart = null;
    rectDragCurrent = null;
    rectDragItem = null;
    rectDrawMode = false;
    btnDrawRect.disabled = false;
    updateRectUI(msg);
    modeHint.textContent = committed
      ? "Region added"
      : "Click to pick · or Draw for region";
    updateCursors();
    drawRectLayer(item);
    if (pickedColor) refreshAllHighlights();
  }

  btnDrawRect.addEventListener("click", () => {
    if (!images.length) return;
    if (!activeImageId) setActiveImage(images[0].id);
    rectDrawMode = true;
    btnDrawRect.disabled = true;
    updateRectUI();
    modeHint.textContent = "Drag to draw";
    updateCursors();
  });

  btnClearRect.addEventListener("click", () => {
    const active = getActiveItem();
    if (!active) return;
    active.rects = [];
    updateRectUI();
    drawRectLayer(active);
    if (pickedColor) refreshAllHighlights();
  });

  rectStatus.addEventListener("click", () => {
    const totalRects = images.reduce((sum, i) => sum + i.rects.length, 0);
    if (totalRects > 0) {
      for (const item of images) {
        drawRectLayer(item);
      }
    }
  });

  btnCancelPick.addEventListener("click", () => {
    pickedColor = null;
    updatePickedUI();
    refreshAllHighlights();
  });

  function updateSliderFill() {
    const val = Number(toleranceEl.value);
    toleranceEl.style.setProperty("--fill", val + "%");
  }

  toleranceEl.addEventListener("input", () => {
    toleranceValue.textContent = toleranceEl.value;
    updateSliderFill();
    if (pickedColor) refreshAllHighlights();
  });

  function hexToRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
    if (!m) return null;
    return {
      r: parseInt(m[1], 16),
      g: parseInt(m[2], 16),
      b: parseInt(m[3], 16),
    };
  }

  function rgbToHex(r, g, b) {
    return (
      "#" +
      [r, g, b]
        .map((v) => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, "0"))
        .join("")
    );
  }

  replaceColor.addEventListener("input", () => {
    const rgb = hexToRgb(replaceColor.value);
    if (!rgb) return;
    const hex = replaceColor.value.toUpperCase();
    rInput.value = String(rgb.r);
    gInput.value = String(rgb.g);
    bInput.value = String(rgb.b);
    hexTextInput.value = hex;
  });

  function onRgbInput() {
    let r = parseInt(rInput.value, 10);
    let g = parseInt(gInput.value, 10);
    let b = parseInt(bInput.value, 10);
    if (Number.isNaN(r)) r = 0;
    if (Number.isNaN(g)) g = 0;
    if (Number.isNaN(b)) b = 0;
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));
    rInput.value = String(r);
    gInput.value = String(g);
    bInput.value = String(b);
    const hex = rgbToHex(r, g, b).toUpperCase();
    replaceColor.value = hex.toLowerCase();
    hexTextInput.value = hex;
  }

  [rInput, gInput, bInput].forEach((el) => el.addEventListener("input", onRgbInput));

  document.querySelectorAll(".preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const hex = btn.getAttribute("data-color");
      if (hex) {
        hexTextInput.value = hex.toUpperCase();
        const rgb = hexToRgb(hex);
        if (rgb) {
          rInput.value = String(rgb.r);
          gInput.value = String(rgb.g);
          bInput.value = String(rgb.b);
          replaceColor.value = hex.toLowerCase();
        }
      }
    });
  });

  hexTextInput.addEventListener("input", () => {
    let hex = hexTextInput.value.trim();
    if (hex.length > 0 && !hex.startsWith("#")) {
      hex = "#" + hex;
      hexTextInput.value = hex;
    }
    if (hex.length === 7) {
      const rgb = hexToRgb(hex);
      if (rgb) {
        rInput.value = String(rgb.r);
        gInput.value = String(rgb.g);
        bInput.value = String(rgb.b);
        replaceColor.value = rgbToHex(rgb.r, rgb.g, rgb.b).toLowerCase();
      }
    }
  });

  btnReplace.addEventListener("click", async () => {
    if (!pickedColor || images.length === 0) return;

    const nr = parseInt(rInput.value, 10);
    const ng = parseInt(gInput.value, 10);
    const nb = parseInt(bInput.value, 10);
    const R = Math.max(0, Math.min(255, nr | 0));
    const G = Math.max(0, Math.min(255, ng | 0));
    const B = Math.max(0, Math.min(255, nb | 0));
    const hex = formatSvgColor(R, G, B);

    let totalReplaced = 0;

    for (const item of images) {
      // 无论是否有选区，都先清除矩形框显示与取色高亮，符合用户“替换后消失”的预期
      item.rctx.clearRect(0, 0, item.rectCanvas.width, item.rectCanvas.height);
      for (const btn of item._rectBtns) btn.remove();
      item._rectBtns = [];
      clearOverlayHighlight(item);

      // 优先用当前活跃选区；若该图已在前次替换后被其他图的取色操作清空选区，
      // 则回落到该图自己的冻结选区，保证多图各自独立替换后仍能继续参与
      const mask = item.selectionCount > 0 ? item.selectionMask : item.frozenMask;
      const count = item.selectionCount > 0 ? item.selectionCount : item.frozenCount;
      if (!mask || count === 0) continue;

      if (item.kind === "svg") {
        const { svg, sites } = collectSvgColorSites(item.svgText || "");
        if (!svg || sites.length !== mask.length) continue;
        applySvgColorSites(sites, (i) => (mask[i] ? hex : null));
        item.svgText = serializeSvg(svg);
        setSvgPreview(item, item.svgText);
        await drawSvgTextToContext(item.svgText, item.width, item.height, item.ictx).catch(
          () => {}
        );
      } else {
        const w = item.width;
        const h = item.height;
        const imgData = item.ictx.getImageData(0, 0, w, h);
        const d = imgData.data;

        for (let i = 0; i < mask.length; i++) {
          if (!mask[i]) continue;
          const py = Math.floor(i / w);
          const px = i % w;
          if (!isInAnyRect(item, px, py)) continue;
          const oi = i * 4;
          d[oi] = R;
          d[oi + 1] = G;
          d[oi + 2] = B;
        }

        item.ictx.putImageData(imgData, 0, 0);
      }

      // 将本次使用的 mask 持久化到 frozenMask，供后续修改颜色后继续替换
      item.frozenMask = mask === item.selectionMask ? mask.slice() : mask;
      item.frozenCount = count;
      item.selectionMask = null;
      item.selectionCount = 0;
      totalReplaced += count;
    }

    selectionStats.textContent =
      totalReplaced > 0
        ? formatSelectionStats(totalReplaced)
        : "Pixels: —";
    modeHint.textContent = "Done · pick again or change color";
    updateReplaceButton();
  });

  function canvasToBlob(canvas) {
    return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  }

  function itemToBlob(item) {
    if (item.kind === "svg") {
      return Promise.resolve(
        new Blob([item.svgText || ""], { type: "image/svg+xml;charset=utf-8" })
      );
    }
    return canvasToBlob(item.imageCanvas);
  }

  function itemDownloadName(item) {
    const base = item.file.name.replace(/\.[^.]+$/, "") || "image";
    return item.kind === "svg" ? base + "-edited.svg" : base + "-edited.png";
  }

  btnDownload.addEventListener("click", async () => {
    if (!images.length) return;

    if (images.length === 1) {
      const item = images[0];
      const blob = await itemToBlob(item);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = itemDownloadName(item);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      return;
    }

    btnDownload.disabled = true;
    const labelEl = document.getElementById("btnDownloadLabel");
    if (labelEl) labelEl.textContent = "Zipping…";

    try {
      const zip = new window.JSZip();
      await Promise.all(
        images.map(async (item) => {
          const blob = await itemToBlob(item);
          zip.file(itemDownloadName(item), blob);
        })
      );

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = "images-edited.zip";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } finally {
      btnDownload.disabled = false;
      updateDownloadButtonLabel();
    }
  });

  function removeImage(id) {
    const index = images.findIndex((i) => i.id === id);
    if (index === -1) return;

    const item = images[index];
    images.splice(index, 1);
    if (item.previewImg) item.previewImg.src = EMPTY_SVG_DATA_URI;
    if (item.highlightImg) item.highlightImg.src = EMPTY_SVG_DATA_URI;
    revokeSvgUrl(item, "svgPreviewUrl");
    revokeSvgUrl(item, "svgHighlightUrl");
    item.card.remove();

    updateGridClass();
    updateUploadHint();
    updateDownloadButtonLabel();
    btnDownload.disabled = images.length === 0;
    btnDrawRect.disabled = images.length === 0;

    if (activeImageId === id) {
      if (images.length > 0) {
        const nextActiveIndex = Math.min(index, images.length - 1);
        setActiveImage(images[nextActiveIndex].id);
      } else {
        setActiveImage(null);
      }
    }

    if (pickedColor) refreshAllHighlights();
    else {
      if (images.length === 0) {
        selectionStats.textContent = "Pixels: —";
      }
      updateReplaceButton();
    }
  }

  /** 创建公共卡片 DOM 与 canvas 层 */
  function buildImageCardShell(file, id, w, h) {
    const card = document.createElement("div");
    card.className = "image-card";
    card.dataset.id = id;

    const wrap = document.createElement("div");
    wrap.className = "image-canvas-wrap cursor-pick";
    wrap.style.aspectRatio = w + " / " + h;

    const imageCanvas = document.createElement("canvas");
    imageCanvas.className = "img-canvas";
    const rectCanvas = document.createElement("canvas");
    rectCanvas.className = "rect-canvas";
    const overlayCanvas = document.createElement("canvas");
    overlayCanvas.className = "overlay-canvas";

    [imageCanvas, rectCanvas, overlayCanvas].forEach((c) => {
      c.width = w;
      c.height = h;
    });

    const btnDelete = document.createElement("button");
    btnDelete.className = "btn-delete-image";
    btnDelete.title = "Remove image";
    btnDelete.innerHTML = `
      <svg viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `;

    const footer = document.createElement("div");
    footer.className = "image-card-footer";
    footer.textContent = `${file.name} · ${w} × ${h}`;

    wrap.appendChild(imageCanvas);
    wrap.appendChild(rectCanvas);
    wrap.appendChild(overlayCanvas);
    card.appendChild(wrap);
    card.appendChild(btnDelete);
    card.appendChild(footer);

    const ictx = imageCanvas.getContext("2d", { willReadFrequently: true });
    const rctx = rectCanvas.getContext("2d");
    const octx = overlayCanvas.getContext("2d", { willReadFrequently: true });

    return {
      card,
      wrap,
      imageCanvas,
      rectCanvas,
      overlayCanvas,
      ictx,
      rctx,
      octx,
      btnDelete,
      footer,
    };
  }

  /** @param {ReturnType<typeof buildImageCardShell>} shell @param {ImageItem} item */
  function wireImageCardEvents(shell, item) {
    shell.overlayCanvas.addEventListener("click", (e) => onOverlayClick(item, e));
    shell.overlayCanvas.addEventListener("pointerdown", (e) => onOverlayPointerDown(item, e));
    shell.overlayCanvas.addEventListener("pointermove", (e) => onOverlayPointerMove(item, e));
    shell.overlayCanvas.addEventListener("pointerup", (e) => onOverlayPointerUp(item, e));
    shell.overlayCanvas.addEventListener("pointercancel", (e) => onOverlayPointerUp(item, e));

    shell.btnDelete.addEventListener("click", (e) => {
      e.stopPropagation();
      removeImage(item.id);
    });

    shell.card.addEventListener("click", (e) => {
      const t = /** @type {HTMLElement} */ (e.target);
      if (t === shell.overlayCanvas || t.closest(".btn-delete-image") || t.closest(".btn-delete-rect"))
        return;
      setActiveImage(item.id);
    });
  }

  /** @param {File} file @returns {Promise<ImageItem|null>} */
  function createRasterItemFromFile(file) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const id = nextId();
        const shell = buildImageCardShell(file, id, w, h);
        shell.footer.textContent = `${file.name} · ${w} × ${h} px`;
        shell.ictx.drawImage(img, 0, 0);

        /** @type {ImageItem} */
        const item = {
          id,
          file,
          kind: "raster",
          svgText: null,
          previewImg: null,
          highlightImg: null,
          svgPreviewUrl: null,
          svgHighlightUrl: null,
          card: shell.card,
          wrap: shell.wrap,
          imageCanvas: shell.imageCanvas,
          rectCanvas: shell.rectCanvas,
          overlayCanvas: shell.overlayCanvas,
          ictx: shell.ictx,
          rctx: shell.rctx,
          octx: shell.octx,
          rects: [],
          _rectBtns: [],
          selectionMask: null,
          selectionCount: 0,
          frozenMask: null,
          frozenCount: 0,
          width: w,
          height: h,
        };

        wireImageCardEvents(shell, item);
        resolve(item);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  }

  /** @param {File} file @returns {Promise<ImageItem|null>} */
  async function createSvgItemFromFile(file) {
    let svgText;
    try {
      svgText = await file.text();
    } catch (_) {
      return null;
    }

    const { svg, sites } = collectSvgColorSites(svgText);
    if (!svg) return null;

    let size = getSvgNaturalSize(svg, svgText);
    if (!size) {
      // Image 探测尺寸
      size = await new Promise((resolve) => {
        const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          const w = Math.max(1, img.naturalWidth || 300);
          const h = Math.max(1, img.naturalHeight || 150);
          URL.revokeObjectURL(url);
          resolve({ w, h });
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve({ w: 300, h: 150 });
        };
        img.src = url;
      });
    }

    // 过大 SVG 限制预览画布，避免内存爆炸（源码仍完整保留）
    const MAX_PREVIEW = 2048;
    let w = size.w;
    let h = size.h;
    if (w > MAX_PREVIEW || h > MAX_PREVIEW) {
      const scale = Math.min(MAX_PREVIEW / w, MAX_PREVIEW / h);
      w = Math.max(1, Math.round(w * scale));
      h = Math.max(1, Math.round(h * scale));
    }

    const id = nextId();
    const shell = buildImageCardShell(file, id, w, h);
    const siteNote = sites.length ? ` · ${sites.length} colors` : "";
    shell.footer.textContent = `${file.name} · SVG${siteNote}`;

    // 矢量预览层：真正的 SVG 渲染，避免 canvas 小图放大锯齿
    const previewImg = document.createElement("img");
    previewImg.className = "svg-preview";
    previewImg.alt = "";
    previewImg.draggable = false;
    shell.wrap.insertBefore(previewImg, shell.imageCanvas);
    shell.imageCanvas.classList.add("svg-backed");

    const highlightImg = document.createElement("img");
    highlightImg.className = "svg-highlight";
    highlightImg.alt = "";
    highlightImg.draggable = false;
    highlightImg.hidden = true;
    highlightImg.src = EMPTY_SVG_DATA_URI;
    shell.wrap.insertBefore(highlightImg, shell.rectCanvas);

    try {
      await drawSvgTextToContext(svgText, w, h, shell.ictx);
    } catch (_) {
      return null;
    }

    /** @type {ImageItem} */
    const item = {
      id,
      file,
      kind: "svg",
      svgText,
      previewImg,
      highlightImg,
      svgPreviewUrl: null,
      svgHighlightUrl: null,
      card: shell.card,
      wrap: shell.wrap,
      imageCanvas: shell.imageCanvas,
      rectCanvas: shell.rectCanvas,
      overlayCanvas: shell.overlayCanvas,
      ictx: shell.ictx,
      rctx: shell.rctx,
      octx: shell.octx,
      rects: [],
      _rectBtns: [],
      selectionMask: null,
      selectionCount: 0,
      frozenMask: null,
      frozenCount: 0,
      width: w,
      height: h,
    };

    setSvgPreview(item, svgText);
    wireImageCardEvents(shell, item);
    return item;
  }

  /** @param {File} file @returns {Promise<ImageItem|null>} */
  function createItemFromFile(file) {
    if (isSvgFile(file)) return createSvgItemFromFile(file);
    return createRasterItemFromFile(file);
  }

  function updateDownloadButtonLabel() {
    const el = document.getElementById("btnDownloadLabel");
    if (!el) return;
    el.textContent = images.length > 1 ? "Download All" : "Download";
  }

  function updateUploadHint() {
    if (!images.length) {
      uploadZone.classList.remove("has-file");
      uploadHint.textContent = "PNG · JPG · WebP · SVG";
      return;
    }
    uploadZone.classList.add("has-file");
    uploadHint.textContent = `${images.length} loaded`;
  }

  /** @param {FileList|File[]} rawFiles */
  function isDuplicate(file) {
    return images.some(
      (item) =>
        item.file.name === file.name &&
        item.file.size === file.size &&
        item.file.lastModified === file.lastModified
    );
  }

  async function appendImages(rawFiles) {
    const list = Array.from(rawFiles || []).filter(
      (f) => isAcceptableImageFile(f) && !isDuplicate(f)
    );
    if (!list.length) return;

    for (const file of list) {
      const item = await createItemFromFile(file);
      if (!item) {
        modeHint.textContent = "Some skipped";
        continue;
      }
      imagesGrid.appendChild(item.card);
      images.push(item);
    }

    updateGridClass();
    updateUploadHint();
    updateDownloadButtonLabel();
    btnDownload.disabled = images.length === 0;
    btnDrawRect.disabled = images.length === 0;

    if (images.length && !activeImageId) {
      setActiveImage(images[0].id);
    } else if (activeImageId && !getActiveItem()) {
      setActiveImage(images.length ? images[0].id : null);
    } else {
      updateRectUI();
      updateCursors();
    }

    if (pickedColor) refreshAllHighlights();
    else {
      selectionStats.textContent = "Pixels: —";
      updateReplaceButton();
    }

    if (images.length) {
      modeHint.textContent = "Click to pick · Draw for region";
    }
  }

  fileInput.addEventListener("change", (e) => {
    const files = e.target.files;
    if (files && files.length) appendImages(files);
    fileInput.value = "";
  });

  uploadZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadZone.classList.add("drag-over");
  });

  uploadZone.addEventListener("dragleave", (e) => {
    if (!uploadZone.contains(/** @type {Node} */ (e.relatedTarget))) {
      uploadZone.classList.remove("drag-over");
    }
  });

  uploadZone.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadZone.classList.remove("drag-over");
    const dt = e.dataTransfer && e.dataTransfer.files;
    if (dt && dt.length) appendImages(dt);
  });

  toleranceValue.textContent = toleranceEl.value;
  updateSliderFill();
  onRgbInput();
  updateCursors();
  if (panelEl && previewEl) {
    new ResizeObserver(() => syncEmptyPreviewHeight()).observe(panelEl);
  }
  window.addEventListener("resize", syncEmptyPreviewHeight);
  syncEmptyPreviewHeight();
  btnReplace.disabled = true;
  updateDownloadButtonLabel();
  btnDownload.disabled = true;
  btnDrawRect.disabled = true;
  btnClearRect.disabled = true;
  selectionStats.textContent = "Pixels: —";
})();
