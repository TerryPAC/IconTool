import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react'
import type { ImageFile } from '../types'
import { formatSize, savingPercent } from '../utils/download'

interface Props {
  item: ImageFile
  onClose: () => void
}

interface ImageBounds {
  left: number
  top: number
  width: number
  height: number
}

function getContainedBounds(cw: number, ch: number, iw: number, ih: number): ImageBounds {
  if (!iw || !ih || !cw || !ch) return { left: 0, top: 0, width: cw, height: ch }
  const scale = Math.min(cw / iw, ch / ih)
  const width = iw * scale
  const height = ih * scale
  return {
    left: (cw - width) / 2,
    top: (ch - height) / 2,
    width,
    height,
  }
}

export function CompareModal({ item, onClose }: Props) {
  const [splitRatio, setSplitRatio] = useState(0.5)
  const [bounds, setBounds] = useState<ImageBounds | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const measureBounds = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    setBounds(getContainedBounds(width, height, item.originalWidth, item.originalHeight))
  }, [item.originalWidth, item.originalHeight])

  useLayoutEffect(() => {
    measureBounds()
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(measureBounds)
    ro.observe(el)
    return () => ro.disconnect()
  }, [measureBounds])

  const updateSplit = useCallback((clientX: number) => {
    const el = containerRef.current
    if (!el || !bounds || bounds.width <= 0) return
    const rect = el.getBoundingClientRect()
    const x = clientX - rect.left - bounds.left
    const ratio = x / bounds.width
    setSplitRatio(Math.max(0, Math.min(1, ratio)))
  }, [bounds])

  const startDragAt = (clientX: number, clientY: number) => {
    if (!bounds) return false
    const rect = containerRef.current!.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top
    if (
      x < bounds.left || x > bounds.left + bounds.width ||
      y < bounds.top || y > bounds.top + bounds.height
    ) return false
    dragging.current = true
    updateSplit(clientX)
    return true
  }

  const handlePointerDown = (e: React.MouseEvent) => {
    if (startDragAt(e.clientX, e.clientY)) e.preventDefault()
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    if (t && startDragAt(t.clientX, t.clientY)) e.preventDefault()
  }

  const onHandleMouseDown = (e: React.MouseEvent) => {
    dragging.current = true
    e.preventDefault()
    e.stopPropagation()
  }

  useEffect(() => {
    const onMove = (e: MouseEvent) => { if (dragging.current) updateSplit(e.clientX) }
    const onUp = () => { dragging.current = false }
    const onTouchMove = (e: TouchEvent) => {
      if (dragging.current && e.touches[0]) updateSplit(e.touches[0].clientX)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onUp)
    }
  }, [updateSplit])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const original = item.file.size
  const compressed = item.outputBlob?.size ?? 0
  const saving = savingPercent(original, compressed)

  const splitPercent = splitRatio * 100

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-up"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Compare"
    >
      <div
        className="glass-strong rounded-2xl overflow-hidden flex flex-col w-full shadow-2xl"
        style={{ maxWidth: 'min(920px, 96vw)', maxHeight: '92vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5 border-b border-white/8 shrink-0">
          <span className="text-sm font-medium text-zinc-200 truncate flex-1">{item.file.name}</span>
          <div className="hidden sm:flex items-center gap-3 text-xs">
            <span className="font-mono text-zinc-500 tabular-nums">{formatSize(original)}</span>
            <span className="text-zinc-700">→</span>
            <span className="font-mono text-zinc-300 tabular-nums">{formatSize(compressed)}</span>
            <span className={`font-mono font-bold tabular-nums ${saving > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {saving > 0 ? `-${saving}%` : `+${Math.abs(saving)}%`}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-500 hover:text-zinc-200 hover:bg-white/8 transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Split view */}
        <div
          ref={containerRef}
          className="relative flex-1 overflow-hidden select-none bg-black/40"
          style={{ minHeight: 280, cursor: bounds ? 'default' : 'wait' }}
          onMouseDown={handlePointerDown}
        >
          {bounds && (
            <div
              className="absolute overflow-hidden"
              style={{
                left: bounds.left,
                top: bounds.top,
                width: bounds.width,
                height: bounds.height,
                cursor: 'col-resize',
              }}
              onMouseDown={handlePointerDown}
              onTouchStart={handleTouchStart}
            >
              <img
                src={item.previewUrl}
                alt="Original"
                className="absolute inset-0 w-full h-full pointer-events-none"
                draggable={false}
              />

              {item.outputPreviewUrl && (
                <img
                  src={item.outputPreviewUrl}
                  alt="Compressed"
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  draggable={false}
                  style={{ clipPath: `inset(0 0 0 ${splitPercent}%)` }}
                />
              )}

              {/* 绿色虚线分割线 */}
              <div
                className="absolute top-0 bottom-0 z-10 pointer-events-none"
                style={{ left: `${splitPercent}%`, transform: 'translateX(-50%)' }}
              >
                <div
                  className="h-full w-0"
                  style={{
                    borderLeft: '2px dashed #34d399',
                    filter: 'drop-shadow(0 0 3px rgba(52,211,153,0.6))',
                  }}
                />
              </div>

              {/* 拖动手柄 */}
              <div
                className="absolute top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center cursor-col-resize"
                style={{
                  left: `${splitPercent}%`,
                  background: 'linear-gradient(135deg, #34d399, #10b981)',
                  boxShadow: '0 0 0 2px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.4)',
                }}
                onMouseDown={onHandleMouseDown}
                onTouchStart={(e) => { dragging.current = true; e.stopPropagation() }}
              >
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l-3 3 3 3M16 9l3 3-3 3" />
                </svg>
              </div>

              {/* 标签 */}
              <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] font-medium text-white/85 pointer-events-none border border-white/10">
                Orig
              </div>
              <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] font-medium text-white/85 pointer-events-none border border-white/10">
                Out
              </div>
            </div>
          )}

          <p className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-zinc-500 pointer-events-none">
            Drag to compare
          </p>
        </div>
      </div>
    </div>
  )
}
