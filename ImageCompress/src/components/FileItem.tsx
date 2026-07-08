import type { ImageFile } from '../types'
import { formatSize, savingPercent, downloadSingle } from '../utils/download'

interface Props {
  item: ImageFile
  onRemove: (id: string) => void
  onPreview: (item: ImageFile) => void
}

function StatusBadge({ status, errorMessage }: { status: ImageFile['status']; errorMessage?: string }) {
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500 bg-white/5 rounded-full px-2 py-0.5">
        Wait
      </span>
    )
  }
  if (status === 'processing') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-cyan-400">
        <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        Busy
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="text-[11px] text-red-400 bg-red-400/10 rounded-full px-2 py-0.5" title={errorMessage}>
        Failed
      </span>
    )
  }
  return null
}

export function FileItem({ item, onRemove, onPreview }: Props) {
  const originalSize = item.file.size
  const compressedSize = item.outputBlob?.size
  const saving = compressedSize != null ? savingPercent(originalSize, compressedSize) : null

  const dim = item.originalWidth && item.originalHeight
    ? `${item.originalWidth}×${item.originalHeight}`
    : null

  const isDone = item.status === 'done'
  const isProcessing = item.status === 'processing'

  return (
    <div className={`relative flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 group transition-colors
      ${isProcessing ? 'bg-cyan-400/[0.03]' : 'hover:bg-white/[0.03]'}`}>
      {/* Processing bar */}
      {isProcessing && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 processing-bar opacity-60" />
      )}

      {/* Thumbnail */}
      <button
        type="button"
        disabled={!isDone}
        onClick={() => isDone && onPreview(item)}
        className={`relative w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-white/5 border transition-all duration-200
          ${isDone
            ? 'border-white/10 cursor-pointer hover:border-emerald-400/40 hover:shadow-[0_0_16px_rgba(52,211,153,0.15)]'
            : 'border-white/8 cursor-default'
          }`}
      >
        <img
          src={item.previewUrl}
          alt={item.file.name}
          className="w-full h-full object-cover"
        />
        {isDone && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            <svg className="w-4 h-4 text-white drop-shadow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          </div>
        )}
      </button>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-200 truncate leading-tight">{item.file.name}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-[11px] font-mono text-zinc-500 tabular-nums">{formatSize(originalSize)}</span>
          {dim && <span className="text-[11px] font-mono text-zinc-600">{dim}</span>}
          {item.outputFileName && item.outputFileName !== item.file.name && (
            <span className="text-[11px] text-zinc-600 truncate max-w-[120px]">→ {item.outputFileName}</span>
          )}
        </div>
      </div>

      {/* Result */}
      <div className="shrink-0 text-right min-w-[72px]">
        {isDone && compressedSize != null && saving != null ? (
          <>
            <p className={`text-sm font-bold font-mono tabular-nums ${saving > 0 ? 'text-emerald-400' : saving < 0 ? 'text-red-400' : 'text-zinc-400'}`}>
              {saving > 0 ? `-${saving}%` : saving < 0 ? `+${Math.abs(saving)}%` : '—'}
            </p>
            <p className="text-[11px] font-mono text-zinc-500 tabular-nums mt-0.5">{formatSize(compressedSize)}</p>
          </>
        ) : (
          <StatusBadge status={item.status} errorMessage={item.errorMessage} />
        )}
      </div>

      {/* Actions */}
      <div className="shrink-0 flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        {isDone && (
          <>
            <button
              type="button"
              title="Compare"
              onClick={() => onPreview(item)}
              className="p-2 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/8 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            </button>
            <button
              type="button"
              title="Download"
              onClick={() => downloadSingle(item)}
              className="p-2 rounded-lg text-zinc-500 hover:text-emerald-400 hover:bg-emerald-400/10 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            </button>
          </>
        )}
        <button
          type="button"
          title="Remove"
          onClick={() => onRemove(item.id)}
          className="p-2 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-400/10 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
