import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import type { ImageFile } from '../types'

/** 下载单张图片 */
export function downloadSingle(item: ImageFile): void {
  if (!item.outputBlob || !item.outputFileName) return
  saveAs(item.outputBlob, item.outputFileName)
}

/** 下载全部已完成图片：列表仅一张时直接下载，多张时打包 ZIP */
export async function downloadAllAsZip(items: ImageFile[]): Promise<void> {
  const done = items.filter((f) => f.status === 'done' && f.outputBlob && f.outputFileName)
  if (done.length === 0) return

  if (items.length === 1) {
    downloadSingle(done[0])
    return
  }

  const zip = new JSZip()
  // 处理同名文件：加编号区分
  const nameCount = new Map<string, number>()
  for (const item of done) {
    const name = item.outputFileName!
    const count = nameCount.get(name) ?? 0
    nameCount.set(name, count + 1)
    const finalName = count === 0 ? name : name.replace(/(\.[^.]+)$/, `_${count}$1`)
    zip.file(finalName, item.outputBlob!)
  }

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
  saveAs(blob, 'ImageTools_compressed.zip')
}

/** 格式化文件大小 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/** 计算节省比例（返回 0–100 的数字） */
export function savingPercent(original: number, compressed: number): number {
  if (original === 0) return 0
  return Math.round(((original - compressed) / original) * 100)
}
