import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  integrations: [react(), tailwind()],
  output: 'static',
  vite: {
    define: {
      'process.env.API_KEY': JSON.stringify(process.env.GEMINI_API_KEY ?? ''),
      'process.env.GEMINI_API_KEY': JSON.stringify(process.env.GEMINI_API_KEY ?? ''),
    },
  },
});
