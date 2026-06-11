# WebTools

A collection of browser-only utilities. All processing happens locally in your browser — nothing is uploaded to a server.

Repository: [github.com/TerryPAC/WebTools](https://github.com/TerryPAC/WebTools)

## Tools

### [IconTool](./IconTool/) — Image Color Picker & Replacer

Upload images, pick a color, adjust tolerance, optionally limit the area with a rectangle, and replace matched pixels with a new color. Supports PNG, JPG, WebP, and more.

### [BannerTool](./BannerTool/) — Live Skia Banner Preview

Edit and preview Skia-style banner JSON for Galaxy S8 (and related `normal` / `ipad` configs). Paste or edit JSON, tweak the S8 section, and see a live CanvasKit render with bundled fonts.

### [ImageCompress](./ImageCompress/) — Batch Image Compression

Batch image compression, WebP conversion, and resizing. Lossy, lossless, and format options. Built with React + Vite; processing runs entirely in the browser.

### [MeasureOverlay](https://terrypac.github.io/MeasurePng/) — Overlay Region Measurement

Measure overlay regions on images, define printable areas with bleed, and export coordinates. Hosted separately on GitHub Pages — repository: [github.com/TerryPAC/MeasurePng](https://github.com/TerryPAC/MeasurePng).

## Project layout

```
/ (root)
├── index.html          # Landing page
├── README.md
├── IconTool/
│   ├── index.html
│   ├── app.js
│   ├── style.css
│   └── README.md
├── BannerTool/
│   ├── index.html
│   ├── app.js
│   ├── vendor/canvaskit/
│   ├── fonts/
│   └── README.md
└── ImageCompress/
    ├── src/
    ├── package.json
    └── README.md
```

## Tech stack

- HTML5, CSS3, vanilla JavaScript
- Canvas API (IconTool)
- CanvasKit / Skia (BannerTool)
- React, Vite, Tailwind CSS (ImageCompress)

## Deployment

Hosted on [GitHub Pages](https://terrypac.github.io/WebTools/). Pushes to `main` trigger [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml), which builds `ImageCompress` and deploys the full site (root landing page, IconTool, BannerTool, and ImageCompress).

In the repository **Settings → Pages**, set **Build and deployment → Source** to **GitHub Actions** (not “Deploy from a branch”).

| Page | URL |
|------|-----|
| Home | [https://terrypac.github.io/WebTools/](https://terrypac.github.io/WebTools/) |
| IconTool | [https://terrypac.github.io/WebTools/IconTool/](https://terrypac.github.io/WebTools/IconTool/) |
| BannerTool | [https://terrypac.github.io/WebTools/BannerTool/](https://terrypac.github.io/WebTools/BannerTool/) |
| ImageCompress | [https://terrypac.github.io/WebTools/ImageCompress/](https://terrypac.github.io/WebTools/ImageCompress/) |
| MeasureOverlay | [https://terrypac.github.io/MeasurePng/](https://terrypac.github.io/MeasurePng/) ([repo](https://github.com/TerryPAC/MeasurePng)) (external) |
