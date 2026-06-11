import imageCompression from 'browser-image-compression'
import type { CompressMode, GlobalSettings, FileOverrides, OutputFormat } from '../types'

export interface CompressOptions {
  mode: CompressMode
  quality: number
  resizeEnabled: boolean
  resizeWidth: number | ''
  resizeHeight: number | ''
  lockAspectRatio: boolean
  outputFormat: OutputFormat
  originalWidth: number
  originalHeight: number
}

/** 合并全局设置与单图覆写，返回实际使用的参数 */
export function mergeSettings(global: GlobalSettings, overrides: FileOverrides): CompressOptions {
  return {
    mode: overrides.mode ?? global.mode,
    quality: overrides.quality ?? global.quality,
    resizeEnabled: overrides.resizeEnabled ?? global.resizeEnabled,
    resizeWidth: overrides.resizeWidth ?? global.resizeWidth,
    resizeHeight: overrides.resizeHeight ?? global.resizeHeight,
    lockAspectRatio: overrides.lockAspectRatio ?? global.lockAspectRatio,
    outputFormat: overrides.outputFormat ?? global.outputFormat,
    originalWidth: 0,
    originalHeight: 0,
  }
}

/** 锁定长宽比时，根据已填一边与原图尺寸计算另一边 */
export function calcPairedDimension(
  entered: number,
  enteredSide: 'width' | 'height',
  originalWidth: number,
  originalHeight: number,
): number {
  const ratio = originalWidth / originalHeight
  return enteredSide === 'width' ? Math.round(entered / ratio) : Math.round(entered * ratio)
}

/** 根据锁定长宽比计算目标尺寸 */
function calcTargetSize(
  opts: CompressOptions,
): { width: number | undefined; height: number | undefined } {
  if (!opts.resizeEnabled) return { width: undefined, height: undefined }

  const w = opts.resizeWidth === '' ? undefined : opts.resizeWidth
  const h = opts.resizeHeight === '' ? undefined : opts.resizeHeight

  if (!opts.lockAspectRatio || opts.originalWidth === 0 || opts.originalHeight === 0) {
    return { width: w, height: h }
  }

  if (w && !h) {
    return { width: w, height: calcPairedDimension(w, 'width', opts.originalWidth, opts.originalHeight) }
  }
  if (h && !w) {
    return { width: calcPairedDimension(h, 'height', opts.originalWidth, opts.originalHeight), height: h }
  }
  return { width: w, height: h }
}

/** 决定输出 MIME 类型 */
function resolveMime(opts: CompressOptions, originalFile: File): string {
  if (opts.mode === 'webp') return 'image/webp'
  if (opts.outputFormat === 'webp') return 'image/webp'
  if (opts.outputFormat === 'jpg') return 'image/jpeg'
  if (opts.outputFormat === 'png') return 'image/png'
  // 保持原格式
  // 有损模式下 PNG 不支持有损压缩，转 WebP（保留透明通道）；其他格式保持原格式
  if (opts.mode === 'lossy') {
    if (originalFile.type === 'image/png') return 'image/webp'
    if (originalFile.type === 'image/webp') return 'image/webp'
    return 'image/jpeg'
  }
  if (originalFile.type === 'image/png') return 'image/png'
  if (originalFile.type === 'image/webp') return 'image/webp'
  return 'image/jpeg'
}

/** 生成输出文件名 */
export function resolveOutputName(originalName: string, mime: string): string {
  const base = originalName.replace(/\.[^.]+$/, '')
  if (mime === 'image/webp') return `${base}.webp`
  if (mime === 'image/png') return `${base}.png`
  return `${base}.jpg`
}

/**
 * 使用 Canvas API 做 resize + 格式转换，返回 Blob
 * 这是核心的处理路径：先 resize，再以目标 mime 导出
 */
function canvasProcess(
  img: HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
  mime: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) { reject(new Error('Cannot get canvas 2D context')); return }
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight)

    // quality 参数 0–1，仅对 jpeg/webp 有效，png 忽略
    const q = mime === 'image/png' ? undefined : quality / 100
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Canvas toBlob returned null'))
      },
      mime,
      q,
    )
  })
}

/** 加载 File 为 HTMLImageElement */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')) }
    img.src = url
  })
}

/**
 * 主压缩函数
 * - 有损 (lossy)：Canvas 输出 jpeg/webp，quality 生效
 * - 无损 (lossless)：Canvas 输出 png；如果原格式是 jpg，则用 browser-image-compression
 *   尽量减小体积（quality=100 + 元数据剥离）
 * - webp 模式：Canvas 输出 webp，quality 生效
 */
export async function compressImage(
  file: File,
  opts: CompressOptions,
): Promise<{ blob: Blob; outputName: string }> {
  const mime = resolveMime(opts, file)
  const outputName = resolveOutputName(file.name, mime)
  const { width: targetW, height: targetH } = calcTargetSize(opts)

  // 加载图片获取原始尺寸
  const img = await loadImage(file)
  const srcW = opts.originalWidth || img.naturalWidth
  const srcH = opts.originalHeight || img.naturalHeight

  const finalW = targetW ?? srcW
  const finalH = targetH ?? srcH

  if (opts.mode === 'lossless' && mime === 'image/png') {
    // 无损 PNG：Canvas resize（如需要）+ browser-image-compression 进一步优化
    let sourceBlob: Blob = file
    if (opts.resizeEnabled && (finalW !== srcW || finalH !== srcH)) {
      sourceBlob = await canvasProcess(img, finalW, finalH, 'image/png', 100)
    }
    const compressed = await imageCompression(new File([sourceBlob], file.name, { type: 'image/png' }), {
      maxSizeMB: 999,
      useWebWorker: true,
      fileType: 'image/png',
      alwaysKeepResolution: true,
    })
    return { blob: compressed, outputName }
  }

  // 有损 / WebP / 其他：Canvas resize + toBlob
  const blob = await canvasProcess(img, finalW, finalH, mime, opts.quality)

  // 如果压缩后比原文件更大，且没有做格式转换和 resize，则直接返回原文件
  const formatChanged = mime !== file.type
  const resized = opts.resizeEnabled && (finalW !== srcW || finalH !== srcH)
  if (!formatChanged && !resized && blob.size >= file.size) {
    return { blob: file, outputName: file.name }
  }

  return { blob, outputName }
}
