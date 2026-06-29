import { debounce } from './utils.js';
import { logInfo, logWarn, logError } from './logger.js';
import { bindUI, setStatus, showToast } from './ui.js';
import { parseS8Text, extractS8FromFullJson, mergeBannerUpdate } from './banner-data.js';
import { createRenderer } from './renderer.js';

const fullJsonEditor = document.getElementById('fullJsonEditor');
const s8Editor = document.getElementById('s8Editor');
const copyBtn = document.querySelector('.copy-icon-btn');
const updateBtn = document.getElementById('updateBtn');

bindUI({
  statusText: document.getElementById('statusText'),
  toastContainer: document.getElementById('toastContainer'),
});

let render = null;
let syncingFromFull = false;

function getS8Raw() {
  return s8Editor.value;
}

function getFullRaw() {
  return fullJsonEditor.value;
}

function syncS8FromFull() {
  const raw = getFullRaw().trim();
  if (!raw) return;
  try {
    const s8 = extractS8FromFullJson(raw);
    if (!s8) {
      logWarn('左侧 JSON 缺少 s8 数组，跳过同步');
      return;
    }
    syncingFromFull = true;
    s8Editor.value = JSON.stringify(s8, null, 2);
    syncingFromFull = false;
    logInfo('已从完整 JSON 同步 s8 到编辑区');
    if (render) render(getS8Raw(), getFullRaw());
  } catch (e) {
    logWarn('左侧 JSON 尚未就绪，跳过同步', e);
  }
}

async function applyUpdate() {
  const fullRaw = getFullRaw().trim();
  if (!fullRaw) {
    const msg = '请先在左侧粘贴完整 JSON';
    setStatus(msg, true);
    showToast(msg, 'error');
    logWarn('Update 失败：左侧 JSON 为空');
    return;
  }

  let fullData;
  let s8Items;
  try {
    fullData = JSON.parse(fullRaw);
    s8Items = parseS8Text(getS8Raw().trim());
    if (!s8Items) {
      const msg = '中间栏 S8 为空';
      setStatus(msg, true);
      showToast(msg, 'error');
      logWarn('Update 失败：中间栏 S8 为空');
      return;
    }
  } catch (e) {
    const msg = 'JSON 解析失败: ' + e.message;
    setStatus(msg, true);
    showToast('JSON 解析失败', 'error');
    logError('Update JSON 解析失败', e);
    return;
  }

  fullJsonEditor.value = JSON.stringify(mergeBannerUpdate(fullData, s8Items), null, 2);
  logInfo('Update 成功，已合并 s8 / ipad / normal');
  await copyFullJson('更新成功，已复制完整 JSON', '配置已更新并复制到剪贴板');
}

async function copyFullJson(statusMsg = '已复制完整 JSON', toastMsg = '已复制完整 JSON') {
  const text = getFullRaw();
  if (!text.trim()) {
    const msg = '当前无可复制内容';
    setStatus(msg, true);
    showToast(msg, 'error');
    logWarn('复制失败：内容为空');
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    setStatus(statusMsg, false);
    showToast(toastMsg, 'success');
    logInfo('已复制完整 JSON 到剪贴板');
  } catch (primaryErr) {
    logWarn('Clipboard API 不可用，尝试 execCommand 回退', primaryErr);
    try {
      fullJsonEditor.select();
      const ok = document.execCommand('copy');
      window.getSelection()?.removeAllRanges();
      if (!ok) throw new Error('execCommand copy 返回 false');
      setStatus(statusMsg, false);
      showToast(toastMsg, 'success');
      logInfo('已通过 execCommand 复制完整 JSON');
    } catch (fallbackErr) {
      const msg = '复制失败，请手动复制';
      setStatus(msg, true);
      showToast(msg, 'error');
      logError('复制到剪贴板失败', fallbackErr);
    }
  }
}

async function init() {
  try {
    const CK = await CanvasKitInit({
      locateFile: (file) => `vendor/canvaskit/${file}`,
    });
    document.getElementById('loadingOverlay').style.display = 'none';

    render = createRenderer(CK, {
      canvas: document.getElementById('skCanvas'),
      emptyPlaceholder: document.getElementById('emptyPlaceholder'),
      deviceScreen: document.getElementById('deviceScreen'),
    });

    fullJsonEditor.addEventListener('input', debounce(syncS8FromFull, 300));
    s8Editor.addEventListener('input', debounce(() => {
      if (!syncingFromFull && render) render(getS8Raw(), getFullRaw());
    }, 300));

    copyBtn?.addEventListener('click', () => copyFullJson());
    updateBtn?.addEventListener('click', () => applyUpdate());

    logInfo('CanvasKit 初始化完成');
  } catch (e) {
    logError('CanvasKit 初始化失败', e);
    document.getElementById('loadingText').textContent = '初始化失败: ' + e.message;
    showToast('初始化失败: ' + e.message, 'error', 5000);
  }
}

init();
