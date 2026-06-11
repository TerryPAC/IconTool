import { useRef, useState, useCallback } from 'react'

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']
const FORMATS = ['PNG', 'JPG', 'WebP', 'GIF', 'AVIF']

interface Props {
  onFiles: (files: File[]) => void
  compact?: boolean
}

export function DropZone({ onFiles, compact }: Props) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return
      const valid = Array.from(fileList).filter((f) => ACCEPTED.includes(f.type))
      if (valid.length > 0) onFiles(valid)
    },
    [onFiles],
  )

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }

  const onDragLeave = () => setDragging(false)

  if (compact) {
    return (
      <button
        type="button"
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200
          ${dragging
            ? 'text-emerald-300 bg-emerald-400/15 border border-emerald-400/40'
            : 'text-zinc-400 bg-white/5 border border-white/8 hover:text-zinc-200 hover:border-white/15 hover:bg-white/8'
          }`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        添加
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED.join(',')}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          onClick={(e) => { (e.target as HTMLInputElement).value = '' }}
        />
      </button>
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="上传图片"
      className={`group relative flex flex-col items-center justify-center gap-5 rounded-2xl cursor-pointer transition-all duration-300 py-16 px-8
        ${dragging
          ? 'border-2 border-emerald-400/60 bg-emerald-400/8 scale-[1.01]'
          : 'border border-dashed border-white/12 hover:border-emerald-400/40 hover:bg-white/[0.03] glass'
        }`}
      style={dragging ? { animation: 'pulse-glow 2s infinite' } : undefined}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
    >
      {/* Corner accents */}
      <div className="absolute top-4 left-4 w-5 h-5 border-t-2 border-l-2 border-emerald-400/30 rounded-tl-lg transition-colors group-hover:border-emerald-400/60" />
      <div className="absolute top-4 right-4 w-5 h-5 border-t-2 border-r-2 border-emerald-400/30 rounded-tr-lg transition-colors group-hover:border-emerald-400/60" />
      <div className="absolute bottom-4 left-4 w-5 h-5 border-b-2 border-l-2 border-emerald-400/30 rounded-bl-lg transition-colors group-hover:border-emerald-400/60" />
      <div className="absolute bottom-4 right-4 w-5 h-5 border-b-2 border-r-2 border-emerald-400/30 rounded-br-lg transition-colors group-hover:border-emerald-400/60" />

      <div className={`relative p-5 rounded-2xl transition-all duration-300
        ${dragging ? 'bg-emerald-400/20 scale-110' : 'bg-white/5 group-hover:bg-emerald-400/10'}`}>
        <svg className={`w-10 h-10 transition-colors duration-300 ${dragging ? 'text-emerald-300' : 'text-zinc-500 group-hover:text-emerald-400'}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
        </svg>
      </div>

      <div className="text-center">
        <p className="text-lg font-semibold text-zinc-100">
          {dragging ? '松开即可上传' : '拖拽图片到这里，或点击选择'}
        </p>
        <p className="text-sm text-zinc-500 mt-2">支持多选，一次处理多张图片</p>
        <div className="flex flex-wrap justify-center gap-2 mt-4">
          {FORMATS.map((fmt) => (
            <span key={fmt} className="text-[11px] font-mono font-medium text-zinc-500 bg-white/5 border border-white/8 rounded-md px-2 py-0.5">
              {fmt}
            </span>
          ))}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED.join(',')}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        onClick={(e) => { (e.target as HTMLInputElement).value = '' }}
      />
    </div>
  )
}
