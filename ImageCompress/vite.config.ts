import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // WebTools monorepo 子路径: https://terrypac.github.io/WebTools/ImageCompress/
  // 本地开发默认 './'；CI 构建时通过 VITE_BASE 注入
  base: process.env.VITE_BASE ?? './',
  plugins: [
    react(),
    tailwindcss(),
  ],
})
