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
      // A sitemap should list only SELF-CANONICAL URLs, and of the four built
      // trees exactly one is self-canonical on mdmc.co:
      //
      //   /      -> canonical self                 KEEP
      //   /ja/   -> canonical https://mdmc.co.jp/  drop (co.jp's sitemap has it)
      //   /jp/   -> a co.jp surface, not public here
      //   /en/   -> canonical https://mdmc.co/…    drop (it is a co.jp surface
      //             whose canonical is already the / tree listed here)
      //
      // /jp and /en were already excluded as co.jp surfaces. /ja/ is dropped
      // too (2026-09-09): it consolidates to co.jp, so listing its 22 URLs
      // here only asked Google to crawl 22 addresses that all point away.
      // Between the two sitemaps every canonical is listed exactly once.
      filter: (page) =>
        !page.startsWith('https://mdmc.co/jp/') &&
        !page.startsWith('https://mdmc.co/en/') &&
        !page.startsWith('https://mdmc.co/ja/'),
    }),
    cojpSitemap(),
  ],
})
