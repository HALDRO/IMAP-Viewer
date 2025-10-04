import { builtinModules } from 'node:module'
import { defineConfig } from 'vite'
import { dependencies, devDependencies } from './package.json'

// https://vitejs.dev/config
export default defineConfig({
  build: {
    lib: {
      entry: 'src/main.ts',
      formats: ['es'],
      fileName: () => 'main.js',
    },
    rollupOptions: {
      // It is not possible to bundle Node.js built-in modules.
      // So we need to externalize them.
      external: [
        'electron',
        'immer',
        ...builtinModules,
        ...builtinModules.map(m => `node:${m}`),
        // Bundle all dependencies except electron and immer
        ...Object.keys(devDependencies),
      ],
      output: {
        format: 'es',
      },
    },
    minify: false,
    target: 'node18',
    // Proper watch configuration for main process
    watch: {
      include: ['src/main.ts', 'src/ipc/**', 'src/services/**'],
      // Ignore data files that change frequently
      exclude: ['**/data/**', '**/node_modules/**', '**/out/**'],
    },
  },
  // Clear screen on rebuild for better visibility
  clearScreen: true,
})
