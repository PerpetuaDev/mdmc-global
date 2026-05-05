import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const STRAPI_URL = 'https://grateful-excellence-5154b8bd7e.strapiapp.com'

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_URL ?? '/',
  server: {
    proxy: {
      '/strapi': {
        target: STRAPI_URL,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/strapi/, ''),
      },
    },
  },
})
