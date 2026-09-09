import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'
import { writeFile } from 'node:fs/promises'
import { cojpUrlsFrom, sitemapXml } from './src/lib/cojp-sitemap.js'

// @astrojs/sitemap is single-site, so it can only ever describe mdmc.co. This
// emits co.jp's own sitemap from the two origin trees the Worker serves there,
// so the Japan domain — which is the CANONICAL host for every Japanese page —
// stops having no sitemap at all. Mapping logic and its tests live in
// src/lib/cojp-sitemap.js.
//
// The file is served at mdmc.co.jp/sitemap-cojp.xml with no Worker change:
// mapPath() forwards any path whose last segment contains a dot straight to
// the origin, so the asset passthrough already covers it (pinned by a case in
// test/ja-proxy.test.js).
function cojpSitemap() {
  return {
    name: 'mdmc-cojp-sitemap',
    hooks: {
      'astro:build:done': async ({ pages, dir, logger }) => {
        const urls = cojpUrlsFrom(pages.map((p) => p.pathname))
        await writeFile(new URL('sitemap-cojp.xml', dir), sitemapXml(urls), 'utf-8')
        logger.info(`sitemap-cojp.xml created at dist (${urls.length} co.jp URLs)`)
      },
    },
  }
}

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
    cojpSitemap(),
  ],
})
