import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import type { Plugin } from 'vite';

// Streng Content-Security-Policy i ferdig bygd app: bare egen kode og
// Supabase får kjøre/hentes. (Ikke i utvikling, der Vite trenger inline-skript.)
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const csp: Plugin = {
  name: 'csp',
  apply: 'build',
  transformIndexHtml: (html) =>
    html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
};

// BASE_PATH settes av GitHub Actions ved publisering til GitHub Pages
// (f.eks. "/Samhandling-/"). Lokalt brukes "/".
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    csp,
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Mors kalender',
        short_name: 'Mors kalender',
        description: 'Felles kalender og vaktordning for familien',
        lang: 'nb',
        theme_color: '#2f5d62',
        background_color: '#f6f4ef',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Bare selve appen (HTML/JS/CSS/ikoner) caches. Data fra serveren
        // caches aldri av service workeren.
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        navigateFallback: 'index.html',
        runtimeCaching: [],
      },
    }),
  ],
});
