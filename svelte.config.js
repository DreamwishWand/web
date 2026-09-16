import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ fallback: '404.html' }),
    paths: {
      // /web on the GitHub Pages project site; empty on localhost or custom domain.
      base: process.env.BASE_PATH ?? ''
    }
  }
};

export default config;
