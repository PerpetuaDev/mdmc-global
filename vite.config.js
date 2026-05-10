import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const STRAPI_URL = 'https://upbeat-approval-82a9e54c20.strapiapp.com'

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
