import { join } from 'path'
import { defineConfig } from 'vite'
import { dependencies, devDependencies } from './package.json'

// https://vitejs.dev/config
export default defineConfig({
  build: {
    lib: {
      entry: {
        preload: join(process.cwd(), 'src', 'preload.ts'),
        'preload-browser': join(process.cwd(), 'src', 'preload-browser.ts'),
      },
      formats: ['cjs'],
      fileName: (format, entryName) => `${entryName}.js`,
    },
    rollupOptions: {
      external: ['electron', ...Object.keys(dependencies), ...Object.keys(devDependencies)],
      output: {
        format: 'cjs',
      },
    },
    minify: false,
    target: 'node18',
    // Watch configuration for preload scripts
    watch: {
      include: ['src/preload.ts', 'src/preload-browser.ts', 'src/ipc/**'],
      exclude: ['**/data/**', '**/node_modules/**', '**/out/**'],
    },
  },
  clearScreen: true,
})
