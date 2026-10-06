// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import rehypeKatex from 'rehype-katex';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';

// Change `site` to your deployed URL (used for RSS, sitemap and canonical links).
// If deploying to https://<user>.github.io/<repo>/, also set `base: '/<repo>'`.
export default defineConfig({
  site: 'https://j2win.me',
  integrations: [mdx(), sitemap()],
  markdown: {
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [rehypeKatex],
    }),
    shikiConfig: {
      theme: 'github-light',
      wrap: false,
      transformers: [
        {
          pre(node) {
            const raw = this.options.meta?.__raw ?? '';
            const m = raw.match(/title=["']([^"']+)["']/);
            if (m) node.properties['data-title'] = m[1];
          },
        },
      ],
    },
  },
});
