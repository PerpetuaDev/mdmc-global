import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'

export default defineConfig({
  site: 'https://mdmc.co',
  output: 'static',
  devToolbar: { enabled: false },
  integrations: [sitemap()],
})
