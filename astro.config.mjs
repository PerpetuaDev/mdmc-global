import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'

export default defineConfig({
  site: 'https://mdmc.co',
  output: 'static',
  devToolbar: { enabled: false },
  integrations: [
    sitemap({
      // /jp and /en are the mdmc.co.jp surfaces (served through the Worker)
      // built at this origin — duplicates by design, consolidated via
      // canonical tags, so they stay out of mdmc.co's sitemap.
      filter: (page) => !page.startsWith('https://mdmc.co/jp/') && !page.startsWith('https://mdmc.co/en/'),
    }),
  ],
})
