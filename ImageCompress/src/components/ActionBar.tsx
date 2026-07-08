import type { ImageFile } from '../types'
import { formatSize, savingPercent, downloadAllAsZip } from '../utils/download'
import { useState } from 'react'

interface Props {
  files: ImageFile[]
  processing: boolean
  onCompress: () => void
}

export function ActionBar({ files, processing, onCompress }: Props) {
  const [downloading, setDownloading] = useState(false)

  const doneFiles = files.filter((f) => f.status === 'done')
  const allDone = files.length > 0 && doneFiles.length === files.length
  const anyDone = doneFiles.length > 0
  const hasPending = files.some((f) => f.status === 'pending')

  const totalOriginal = files.reduce((acc, f) => acc + f.file.size, 0)
  const totalCompressed = doneFiles.reduce((acc, f) => acc + (f.outputBlob?.size ?? 0), 0)
  const saving = anyDone ? savingPercent(
    doneFiles.reduce((acc, f) => acc + f.file.size, 0),
    totalCompressed,
  ) : null

  const singleFile = files.length === 1

  const handleDownloadAll = async () => {
    if (!singleFile) setDownloading(true)
    try {
      await downloadAllAsZip(files)
    } finally {
      if (!singleFile) setDownloading(false)
    }
  }

  if (files.length === 0) return null

  return (
    <div className="glass-strong rounded-2xl px-4 sm:px-5 py-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
      {/* Stats */}
      <div className="flex items-center gap-4 flex-1 min-w-0">
        {anyDone ? (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex flex-col">
              <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Orig</span>
              <span className="font-mono text-sm font-medium text-zinc-300 tabular-nums">
                {formatSize(doneFiles.reduce((a, f) => a + f.file.size, 0))}
              </span>
            </div>
            <svg className="w-4 h-4 text-zinc-700 shrink-0 hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
            <div className="flex flex-col">
              <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Out</span>
              <span className="font-mono text-sm font-medium text-zinc-200 tabular-nums">
                {formatSize(totalCompressed)}
              </span>
            </div>
            {saving != null && (
              <div className={`flex flex-col ${saving > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                <span className="text-[10px] uppercase tracking-wider opacity-70">Save</span>
                <span className="font-mono text-sm font-bold tabular-nums">
                  {saving > 0 ? `${saving}%` : `+${Math.abs(saving)}%`}
                </span>
              </div>
            )}
          </div>
        ) : (
          <span className="text-sm text-zinc-500">
            <span className="font-mono text-zinc-400">{files.length}</span> file{files.length !== 1 ? 's' : ''} · total{' '}
            <span className="font-mono text-zinc-400">{formatSize(totalOriginal)}</span>
          </span>
        )}
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-2.5 shrink-0">
        {anyDone && (
          <button
            type="button"
            onClick={handleDownloadAll}
            disabled={downloading}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-white/10 text-zinc-300 hover:border-white/20 hover:text-white hover:bg-white/5 transition-all disabled:opacity-50"
          >
            {downloading ? (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            )}
            {downloading ? 'Zipping…' : singleFile ? 'Download' : `All (${doneFiles.length})`}
          </button>
        )}

        <button
          type="button"
          onClick={onCompress}
          disabled={processing || (!hasPending && !allDone)}
          className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200
            ${processing
              ? 'bg-emerald-600/40 text-emerald-200 cursor-wait'
              : hasPending || files.length > 0
                ? 'text-white hover:brightness-110 active:scale-[0.98]'
                : 'bg-white/5 text-zinc-600 cursor-not-allowed'
            }`}
          style={!processing && (hasPending || files.length > 0) ? {
            background: 'linear-gradient(135deg, #34d399, #10b981)',
            boxShadow: '0 4px 20px rgba(52, 211, 153, 0.25)',
          } : undefined}
        >
          {processing ? (
            <>
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Processing…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
              {allDone ? 'Again' : 'Compress'}
            </>
          )}
        </button>
      </div>
    </div>
  )
}
