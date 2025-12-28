import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { build } from 'vite';

// Content script needs separate IIFE build (no ES module imports)
async function buildContentScript() {
  await build({
    configFile: false,
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: false, // Don't clear - main build already ran
      lib: {
        entry: resolve(__dirname, 'src/content/index.ts'),
        name: 'PerfectReproContent',
        formats: ['iife'],
        fileName: () => 'content.js',
      },
      rollupOptions: {
        output: {
          extend: true,
        },
      },
      minify: 'esbuild',
      target: 'esnext',
    },
  });
}

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'copy-manifest',
      writeBundle() {
        // Copy manifest.json to dist
        if (existsSync('public/manifest.json')) {
          copyFileSync('public/manifest.json', 'dist/manifest.json');
        }
        // Copy icons
        const iconsDir = 'dist/icons';
        if (!existsSync(iconsDir)) {
          mkdirSync(iconsDir, { recursive: true });
        }
        ['icon-16.png', 'icon-48.png', 'icon-128.png'].forEach((icon) => {
          const src = `public/icons/${icon}`;
          if (existsSync(src)) {
            copyFileSync(src, `dist/icons/${icon}`);
          }
        });
        // Copy content.css
        if (existsSync('public/content.css')) {
          copyFileSync('public/content.css', 'dist/content.css');
        }
      },
    },
    {
      name: 'build-content-script',
      closeBundle: async () => {
        // Build content script as IIFE after main build
        await buildContentScript();
      },
    },
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // Keep background as root-level file
          if (chunkInfo.name === 'background') {
            return '[name].js';
          }
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          // Keep CSS files at appropriate locations
          if (assetInfo.name?.endsWith('.css')) {
            return 'assets/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
    sourcemap: process.env.NODE_ENV === 'development',
    minify: 'esbuild',
    target: 'esnext',
  },
  publicDir: false, // We handle public files manually
});
