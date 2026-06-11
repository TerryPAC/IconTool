import type { GlobalSettings, CompressMode, OutputFormat } from '../types'
import { calcPairedDimension } from '../utils/compress'

interface Props {
  settings: GlobalSettings
  onChange: (s: GlobalSettings) => void
  /** 锁定长宽比时的参考原图尺寸（通常为列表首张） */
  referenceSize?: { width: number; height: number }
}

const MODES: { id: CompressMode; label: string; desc: string; icon: string }[] = [
  { id: 'lossy', label: '有损', desc: '体积最小', icon: '📉' },
  { id: 'lossless', label: '无损', desc: '零损失', icon: '✨' },
  { id: 'webp', label: 'WebP', desc: '现代格式', icon: '🌐' },
]

const OUTPUT_FORMATS: { id: OutputFormat; label: string }[] = [
  { id: 'original', label: '原格式' },
  { id: 'webp', label: 'WebP' },
  { id: 'jpg', label: 'JPG' },
  { id: 'png', label: 'PNG' },
]

function SectionTitle({ children }: { children: string }) {
  return (
    <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">
      {children}
    </h3>
  )
}

export function SettingsPanel({ settings, onChange, referenceSize }: Props) {
  const set = (partial: Partial<GlobalSettings>) => onChange({ ...settings, ...partial })

  const showQuality = settings.mode !== 'lossless'
  const showOutputFormat = settings.mode !== 'webp'

  const handleWidthChange = (val: string) => {
    const w = val === '' ? '' : parseInt(val, 10) || ''
    set({ resizeWidth: w })
  }

  const handleHeightChange = (val: string) => {
    const h = val === '' ? '' : parseInt(val, 10) || ''
    set({ resizeHeight: h })
  }

  const syncPairedDimension = (edited: 'width' | 'height') => {
    if (!settings.lockAspectRatio || !referenceSize) return
    const { width: refW, height: refH } = referenceSize
    if (refW === 0 || refH === 0) return

    if (edited === 'width') {
      const w = settings.resizeWidth
      if (w === '' || settings.resizeHeight !== '') return
      set({ resizeHeight: calcPairedDimension(w, 'width', refW, refH) })
      return
    }

    const h = settings.resizeHeight
    if (h === '' || settings.resizeWidth !== '') return
    set({ resizeWidth: calcPairedDimension(h, 'height', refW, refH) })
  }

  return (
    <aside className="glass rounded-2xl p-5 flex flex-col gap-6 w-full lg:w-64 shrink-0 lg:sticky lg:top-6">
      {/* 压缩模式 */}
      <div>
        <SectionTitle>压缩模式</SectionTitle>
        <div className="grid grid-cols-3 lg:grid-cols-1 gap-2">
          {MODES.map((m) => {
            const active = settings.mode === m.id
            return (
              <button
                key={m.id}
                type="button"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 border text-left
                  ${active
                    ? 'bg-emerald-400/12 border-emerald-400/40 text-white shadow-[0_0_20px_rgba(52,211,153,0.08)]'
                    : 'bg-white/[0.03] border-white/8 text-zinc-400 hover:border-white/15 hover:text-zinc-200 hover:bg-white/5'
                  }`}
                onClick={() => set({ mode: m.id })}
              >
                <span className="text-base leading-none">{m.icon}</span>
                <div className="min-w-0">
                  <p className="font-semibold leading-tight">{m.label}</p>
                  <p className={`text-[10px] mt-0.5 ${active ? 'text-emerald-400/70' : 'text-zinc-600'}`}>{m.desc}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* 质量滑块 */}
      {showQuality && (
        <div>
          <SectionTitle>压缩质量</SectionTitle>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-zinc-500">低质量 / 小体积</span>
            <span className="font-mono text-sm font-semibold text-emerald-400 tabular-nums">{settings.quality}</span>
          </div>
          <input
            type="range"
            min={1}
            max={100}
            value={settings.quality}
            className="styled w-full"
            style={{ '--val': `${settings.quality}%` } as React.CSSProperties}
            onChange={(e) => set({ quality: Number(e.target.value) })}
          />
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] font-mono text-zinc-600">1</span>
            <span className="text-[10px] font-mono text-zinc-600">100</span>
          </div>
        </div>
      )}

      {/* 尺寸缩放 */}
      <div>
        <SectionTitle>尺寸缩放</SectionTitle>
        <label className="flex items-center justify-between cursor-pointer mb-3 select-none">
          <span className={`text-sm font-medium ${settings.resizeEnabled ? 'text-zinc-200' : 'text-zinc-500'}`}>
            启用缩放
          </span>
          <div
            role="switch"
            aria-checked={settings.resizeEnabled}
            className={`toggle ${settings.resizeEnabled ? 'on' : ''}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => set({ resizeEnabled: !settings.resizeEnabled })}
          />
        </label>

        {settings.resizeEnabled && (
          <div className="flex flex-col gap-3 select-none">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="text-[10px] text-zinc-500 block mb-1.5 font-medium">宽度 px</label>
                <input
                  type="number"
                  min={1}
                  placeholder="自动"
                  value={settings.resizeWidth}
                  onChange={(e) => handleWidthChange(e.target.value)}
                  onBlur={() => syncPairedDimension('width')}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-400/50 transition-colors"
                />
              </div>
              <span className="text-zinc-600 mt-5 font-light">×</span>
              <div className="flex-1">
                <label className="text-[10px] text-zinc-500 block mb-1.5 font-medium">高度 px</label>
                <input
                  type="number"
                  min={1}
                  placeholder="自动"
                  value={settings.resizeHeight}
                  onChange={(e) => handleHeightChange(e.target.value)}
                  onBlur={() => syncPairedDimension('height')}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-400/50 transition-colors"
                />
              </div>
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={settings.lockAspectRatio}
                onChange={(e) => set({ lockAspectRatio: e.target.checked })}
                className="w-4 h-4 rounded accent-emerald-400 cursor-pointer"
              />
              <span className="text-xs text-zinc-400 group-hover:text-zinc-300 transition-colors">锁定长宽比</span>
            </label>
          </div>
        )}
      </div>

      {/* 输出格式 */}
      {showOutputFormat && (
        <div>
          <SectionTitle>输出格式</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {OUTPUT_FORMATS.map((f) => {
              const active = settings.outputFormat === f.id
              return (
                <button
                  key={f.id}
                  type="button"
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border
                    ${active
                      ? 'bg-white/10 border-white/20 text-white'
                      : 'bg-transparent border-white/8 text-zinc-500 hover:border-white/15 hover:text-zinc-300'
                    }`}
                  onClick={() => set({ outputFormat: f.id })}
                >
                  {f.label}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </aside>
  )
}
