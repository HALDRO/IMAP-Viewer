import { builtinModules } from 'node:module'
import { resolve } from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve('src'),
    },
  },
  plugins: [react(), tailwindcss()],
  build: {
    // Performance optimizations
    minify: 'esbuild',
    target: 'esnext',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      // Externalize Node.js built-in modules to prevent them from being bundled
      external: ['electron', ...builtinModules, ...builtinModules.map(m => `node:${m}`)],
      output: {
        // Allow Vite to automatically determine chunks - this is safer and prevents circular dependencies
        manualChunks: undefined,
      },
    },
  },
  server: {
    port: 4100,
    strictPort: true,
    hmr: {
      port: 4102,
      host: 'localhost',
      clientPort: 4102,
    },
    watch: {
      // Ignore config.json to prevent reload loops
      ignored: [
        '**/config.json',
        '**/accounts.txt',
        '**/domains.txt',
        '**/proxies.txt',
        '**/data/**',
        '**/out/**',
        '**/node_modules/**',
        '**/.git/**',
      ],
      // Enable polling on Windows for reliable file watching
      usePolling: process.platform === 'win32',
      interval: 300,
    },
  },
  // Clear screen on rebuild for better visibility
  clearScreen: true,
  optimizeDeps: {
    // Exclude problematic dependencies from pre-bundling
    exclude: ['electron'],
  },
})
