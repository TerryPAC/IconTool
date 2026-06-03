# WebTools

A collection of browser-only utilities. All processing happens locally in your browser — nothing is uploaded to a server.

Repository: [github.com/TerryPAC/WebTools](https://github.com/TerryPAC/WebTools)

## Tools

### [IconTool](./IconTool/) — Image Color Picker & Replacer

Upload images, pick a color, adjust tolerance, optionally limit the area with a rectangle, and replace matched pixels with a new color. Supports PNG, JPG, WebP, and more.

### [BannerTool](./BannerTool/) — Live Skia Banner Preview

Edit and preview Skia-style banner JSON for Galaxy S8 (and related `normal` / `ipad` configs). Paste or edit JSON, tweak the S8 section, and see a live CanvasKit render with bundled fonts.

### [MeasurePng](https://terrypac.github.io/MeasurePng/) — PNG Transparent Area Measurement

Detect transparent areas in images, define printable regions with bleed, and export overlay coordinates. Hosted separately on GitHub Pages.

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
└── BannerTool/
    ├── index.html
    ├── app.js
    ├── vendor/canvaskit/
    ├── fonts/
    └── README.md
```

## Tech stack

- HTML5, CSS3, vanilla JavaScript
- Canvas API (IconTool)
- CanvasKit / Skia (BannerTool)

## Deployment

Hosted on [GitHub Pages](https://terrypac.github.io/WebTools/):

| Page | URL |
|------|-----|
| Home | [https://terrypac.github.io/WebTools/](https://terrypac.github.io/WebTools/) |
| IconTool | [https://terrypac.github.io/WebTools/IconTool/](https://terrypac.github.io/WebTools/IconTool/) |
| BannerTool | [https://terrypac.github.io/WebTools/BannerTool/](https://terrypac.github.io/WebTools/BannerTool/) |
| MeasurePng | [https://terrypac.github.io/MeasurePng/](https://terrypac.github.io/MeasurePng/) (external) |
