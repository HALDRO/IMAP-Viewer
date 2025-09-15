import { defineConfig } from 'vite';
import { devDependencies } from './package.json';
import { builtinModules } from 'node:module';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      // It is not possible to bundle Node.js built-in modules.
      // So we need to externalize them.
      external: [
        'electron',
        ...builtinModules,
        ...Object.keys(devDependencies),
      ]
    }
  }
});
