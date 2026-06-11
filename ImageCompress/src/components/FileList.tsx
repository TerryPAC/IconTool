import { DropZone } from './DropZone'
import { FileItem } from './FileItem'
import type { ImageFile } from '../types'
import { formatSize, savingPercent } from '../utils/download'

interface Props {
  files: ImageFile[]
  onAddFiles: (files: File[]) => void
  onRemove: (id: string) => void
  onPreview: (item: ImageFile) => void
  onClear: () => void
}

export function FileList({ files, onAddFiles, onRemove, onPreview, onClear }: Props) {
  const totalOriginal = files.reduce((acc, f) => acc + f.file.size, 0)
  const totalCompressed = files.reduce((acc, f) => acc + (f.outputBlob?.size ?? 0), 0)
  const doneCount = files.filter((f) => f.status === 'done').length
  const processingCount = files.filter((f) => f.status === 'processing').length
  const saving = doneCount > 0 ? savingPercent(
    files.filter((f) => f.status === 'done').reduce((a, f) => a + f.file.size, 0),
    totalCompressed,
  ) : null

  if (files.length === 0) {
    return <DropZone onFiles={onAddFiles} />
  }

  return (
    <div className="glass rounded-2xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5 border-b border-white/8">
        <div className="flex items-center gap-2.5 min-w-0">
          <h2 className="text-sm font-semibold text-zinc-200">文件列表</h2>
          <span className="font-mono text-[11px] text-zinc-400 bg-white/5 border border-white/8 rounded-full px-2 py-0.5 tabular-nums">
            {files.length}
          </span>
          {processingCount > 0 && (
            <span className="text-[11px] text-cyan-400 animate-pulse">处理中…</span>
          )}
        </div>

        <div className="flex-1" />

        {doneCount > 0 && (
          <div className="hidden sm:flex items-center gap-3 text-xs text-zinc-500">
            <span className="font-mono tabular-nums">{formatSize(totalOriginal)}</span>
            <svg className="w-3.5 h-3.5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
            <span className="font-mono tabular-nums text-zinc-300">{formatSize(totalCompressed)}</span>
            {saving != null && saving > 0 && (
              <span className="font-semibold text-emerald-400">-{saving}%</span>
            )}
          </div>
        )}

        <DropZone onFiles={onAddFiles} compact />
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-zinc-500 hover:text-red-400 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-red-400/10"
        >
          清空
        </button>
      </div>

      {/* List */}
      <div className="overflow-y-auto max-h-[min(520px,60vh)] divide-y divide-white/5">
        {files.map((f) => (
          <FileItem
            key={f.id}
            item={f}
            onRemove={onRemove}
            onPreview={onPreview}
          />
        ))}
      </div>
    </div>
  )
}
