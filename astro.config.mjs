import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://syverstack.com',
  output: 'static',
  integrations: [mdx()],
  build: {
    assets: 'assets',
  },
  vite: {
    build: {
      rollupOptions: {
        external: [],
      },
    },
  },
});
