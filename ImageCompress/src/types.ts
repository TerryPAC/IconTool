export type CompressMode = 'lossy' | 'lossless' | 'webp'

export type OutputFormat = 'original' | 'webp' | 'jpg' | 'png'

export type FileStatus = 'pending' | 'processing' | 'done' | 'error'

/** 全局处理设置 */
export interface GlobalSettings {
  mode: CompressMode
  /** 质量 1–100，仅有损/WebP模式有效 */
  quality: number
  /** 是否启用尺寸缩放 */
  resizeEnabled: boolean
  resizeWidth: number | ''
  resizeHeight: number | ''
  /** 是否锁定长宽比 */
  lockAspectRatio: boolean
  outputFormat: OutputFormat
}

/** 单张图片的覆写设置（undefined = 跟随全局） */
export interface FileOverrides {
  mode?: CompressMode
  quality?: number
  resizeEnabled?: boolean
  resizeWidth?: number | ''
  resizeHeight?: number | ''
  lockAspectRatio?: boolean
  outputFormat?: OutputFormat
}

/** 文件列表中每一项的状态 */
export interface ImageFile {
  id: string
  file: File
  /** 原始图片预览 URL（Object URL） */
  previewUrl: string
  /** 原始尺寸（像素） */
  originalWidth: number
  originalHeight: number
  /** 压缩后的 Blob */
  outputBlob: Blob | null
  /** 压缩后预览 URL */
  outputPreviewUrl: string | null
  /** 压缩后输出文件名 */
  outputFileName: string | null
  status: FileStatus
  errorMessage?: string
  /** 单图自定义设置 */
  overrides: FileOverrides
}
