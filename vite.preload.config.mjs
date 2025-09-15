import { join } from 'path';
import { defineConfig } from 'vite';
import { dependencies, devDependencies } from './package.json';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      input: join(process.cwd(), 'src', 'preload.ts'), // Here
      external: [
        'electron',
        ...Object.keys(dependencies),
        ...Object.keys(devDependencies),
      ]
    }
  }
});
