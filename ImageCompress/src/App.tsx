import { useState, useCallback } from 'react'
import { DropZone } from './components/DropZone'
import { SettingsPanel } from './components/SettingsPanel'
import { FileList } from './components/FileList'
import { ActionBar } from './components/ActionBar'
import { CompareModal } from './components/CompareModal'
import type { ImageFile, GlobalSettings } from './types'
import { compressImage, mergeSettings } from './utils/compress'

const DEFAULT_SETTINGS: GlobalSettings = {
  mode: 'lossy',
  quality: 75,
  resizeEnabled: false,
  resizeWidth: '',
  resizeHeight: '',
  lockAspectRatio: true,
  outputFormat: 'original',
}

const FEATURES = [
  { icon: '⚡', title: '极速压缩', desc: '浏览器本地处理，无需上传' },
  { icon: '🔒', title: '隐私安全', desc: '图片不离开你的设备' },
  { icon: '📦', title: '批量导出', desc: '一键打包 ZIP 下载' },
]

let idCounter = 0
const genId = () => `img_${++idCounter}`

async function createImageFile(file: File): Promise<ImageFile> {
  const previewUrl = URL.createObjectURL(file)
  const { width, height } = await new Promise<{ width: number; height: number }>((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => resolve({ width: 0, height: 0 })
    img.src = previewUrl
  })
  return {
    id: genId(),
    file,
    previewUrl,
    originalWidth: width,
    originalHeight: height,
    outputBlob: null,
    outputPreviewUrl: null,
    outputFileName: null,
    status: 'pending',
    overrides: {},
  }
}

export default function App() {
  const [settings, setSettings] = useState<GlobalSettings>(DEFAULT_SETTINGS)
  const [files, setFiles] = useState<ImageFile[]>([])
  const [processing, setProcessing] = useState(false)
  const [previewItem, setPreviewItem] = useState<ImageFile | null>(null)

  const handleAddFiles = useCallback(async (newFiles: File[]) => {
    const items = await Promise.all(newFiles.map(createImageFile))
    setFiles((prev) => {
      const existingKeys = new Set(prev.map((f) => `${f.file.name}_${f.file.size}`))
      const unique = items.filter((i) => !existingKeys.has(`${i.file.name}_${i.file.size}`))
      return [...prev, ...unique]
    })
  }, [])

  const handleRemove = useCallback((id: string) => {
    setFiles((prev) => {
      const item = prev.find((f) => f.id === id)
      if (item) {
        URL.revokeObjectURL(item.previewUrl)
        if (item.outputPreviewUrl) URL.revokeObjectURL(item.outputPreviewUrl)
      }
      return prev.filter((f) => f.id !== id)
    })
  }, [])

  const handleClear = useCallback(() => {
    setFiles((prev) => {
      prev.forEach((item) => {
        URL.revokeObjectURL(item.previewUrl)
        if (item.outputPreviewUrl) URL.revokeObjectURL(item.outputPreviewUrl)
      })
      return []
    })
  }, [])

  const handleCompress = useCallback(async () => {
    if (processing) return
    setProcessing(true)

    setFiles((prev) =>
      prev.map((f) => ({
        ...f,
        status: 'pending' as const,
        outputBlob: null,
        outputPreviewUrl: f.outputPreviewUrl
          ? (URL.revokeObjectURL(f.outputPreviewUrl), null)
          : null,
        outputFileName: null,
        errorMessage: undefined,
      })),
    )

    const snapshot = await new Promise<ImageFile[]>((resolve) => {
      setFiles((prev) => { resolve(prev); return prev })
    })

    for (const item of snapshot) {
      setFiles((prev) =>
        prev.map((f) => f.id === item.id ? { ...f, status: 'processing' } : f),
      )

      try {
        const opts = mergeSettings(settings, item.overrides)
        opts.originalWidth = item.originalWidth
        opts.originalHeight = item.originalHeight

        const { blob, outputName } = await compressImage(item.file, opts)
        const outputPreviewUrl = URL.createObjectURL(blob)

        setFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? { ...f, status: 'done', outputBlob: blob, outputPreviewUrl, outputFileName: outputName }
              : f,
          ),
        )
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setFiles((prev) =>
          prev.map((f) => f.id === item.id ? { ...f, status: 'error', errorMessage: msg } : f),
        )
      }
    }

    setProcessing(false)
  }, [processing, settings])

  const hasFiles = files.length > 0

  return (
    <div className="app-bg min-h-screen text-zinc-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 flex flex-col gap-8 min-h-screen">
        {/* Header */}
        <header className="animate-fade-up flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3.5">
              <div className="relative w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(135deg, rgba(52,211,153,0.2), rgba(34,211,238,0.15))' }}>
                <div className="absolute inset-0 rounded-xl border border-emerald-400/20" />
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">ImageCompress</h1>
                <p className="text-sm text-zinc-500 mt-0.5">批量压缩 · WebP 转换 · 尺寸调整</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400/90 bg-emerald-400/10 border border-emerald-400/20 rounded-full px-3 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                纯前端 · 隐私安全
              </span>
            </div>
          </div>
        </header>

        {/* Empty state */}
        {!hasFiles && (
          <div className="flex-1 flex flex-col gap-8">
            <div className="animate-fade-up animate-fade-up-delay-1">
              <DropZone onFiles={handleAddFiles} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-up animate-fade-up-delay-2">
              {FEATURES.map((f) => (
                <div key={f.title} className="glass rounded-2xl p-5 flex items-start gap-4">
                  <span className="text-2xl leading-none mt-0.5">{f.icon}</span>
                  <div>
                    <p className="font-semibold text-zinc-200 text-sm">{f.title}</p>
                    <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Workspace */}
        {hasFiles && (
          <div className="flex flex-col lg:flex-row gap-5 items-start animate-fade-up">
            <SettingsPanel
              settings={settings}
              onChange={setSettings}
              referenceSize={
                files[0]
                  ? { width: files[0].originalWidth, height: files[0].originalHeight }
                  : undefined
              }
            />
            <div className="flex-1 min-w-0 flex flex-col gap-4 w-full">
              <FileList
                files={files}
                onAddFiles={handleAddFiles}
                onRemove={handleRemove}
                onPreview={setPreviewItem}
                onClear={handleClear}
              />
              <ActionBar
                files={files}
                processing={processing}
                onCompress={handleCompress}
              />
            </div>
          </div>
        )}

        <footer className="mt-auto pt-4 text-center text-xs text-zinc-600">
          图片在浏览器本地处理，不上传任何服务器
        </footer>
      </div>

      {previewItem && (
        <CompareModal
          item={previewItem}
          onClose={() => setPreviewItem(null)}
        />
      )}
    </div>
  )
}
