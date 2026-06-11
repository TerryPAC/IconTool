# ImageTools

A fast, privacy-first image compression tool that runs entirely in your browser. No uploads, no servers — your images never leave your device.

**[Try it online →](https://terrypac.github.io/WebTools/ImageCompress/)**

---

## Features

- **Lossy compression** — Significantly reduces file size. PNG files are automatically converted to WebP (preserving transparency). JPG/WebP files are re-encoded at your chosen quality.
- **Lossless compression** — Reduces file size without any quality loss. Best for PNG files that need pixel-perfect output.
- **Convert to WebP** — Converts PNG/JPG to WebP format with adjustable quality. WebP is typically 25–35% smaller than equivalent JPG/PNG.
- **Resize** — Scale images to a specific width/height in pixels. Aspect ratio can be locked.
- **Batch processing** — Upload and compress multiple images at once. Download them all as a single ZIP file.
- **Before/After comparison** — Click any compressed image to open a split-view comparison with a draggable divider.

---

## How to Use

```
┌─────────────────────────────────────────────────────────┐
│  1. Upload                                              │
│     Drag & drop or click to select images               │
│     Supports PNG · JPG · WebP · GIF · AVIF (multi-select) │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  2. Choose Mode                                         │
│                                                         │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│   │  Lossy   │  │ Lossless │  │   WebP   │            │
│   │ quality  │  │  PNG     │  │ convert  │            │
│   │ 1 – 100  │  │ optimized│  │ quality  │            │
│   └──────────┘  └──────────┘  └──────────┘            │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  3. Adjust Settings (optional)                          │
│                                                         │
│   Quality slider  ──────────────●───  80               │
│   Resize          [ ] Enable  1920 × 1080  [lock ratio] │
│   Output format   ○ Original  ○ WebP  ○ JPG  ○ PNG     │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  4. Compress                                            │
│     Click "Start Compression"                           │
│     Each image shows its result as it finishes:         │
│                                                         │
│     photo.jpg   3.2 MB  ──►  0.9 MB   -71%  ✓         │
│     banner.png  2.8 MB  ──►  0.4 MB   -85%  ✓         │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  5. Download                                            │
│                                                         │
│   [ ↓ single image ]  Click the download icon per row  │
│   [ ↓ Download All ]  Get a ZIP of all results         │
│   [ ◧ compare view ]  Click thumbnail for split-view   │
└─────────────────────────────────────────────────────────┘
```

### Compression mode guide

| Mode | Output format | Quality setting | Best for |
|------|--------------|-----------------|----------|
| **Lossy** | JPG / WebP (PNG → WebP) | Yes | Photos, social media images |
| **Lossless** | PNG | No | Icons, screenshots, graphics with text |
| **WebP** | WebP | Yes | Any image — modern format, smallest size |

### Settings reference

- **Quality** (1–100) — Controls the trade-off between file size and visual quality. **75–85** is recommended for most photos.
- **Resize** — Set a target width and/or height in pixels. Enable "Lock aspect ratio" to scale proportionally without distortion.
- **Output format** — Overrides the default format. Useful when you want to force a specific format regardless of the input type.

---

## Privacy

All processing happens locally in your browser. No image data is ever sent to a server. The tool works completely offline once the page has loaded.
