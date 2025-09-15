import { defineConfig } from 'vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { builtinModules } from 'node:module';

// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve('src'),
    },
  },
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      // Externalize Node.js built-in modules to prevent them from being bundled
      external: [
        'electron',
        ...builtinModules,
        ...builtinModules.map(m => `node:${m}`),
      ]
    }
  },
  server: {
    port: 4100,
    hmr: {
      port: 4101,
    },
    watch: {
      // Ignore config.json to prevent reload loops
      ignored: ['**/config.json', '**/accounts.txt', '**/domains.txt', '**/proxies.txt', '**/data/**', '**/out/**', '**/node_modules/**'],
      // More precise file watching
      usePolling: false,
      interval: 100,
    }
  },
  optimizeDeps: {
    // Exclude problematic dependencies from pre-bundling
    exclude: ['electron']
  }
});
