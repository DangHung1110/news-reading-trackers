import { resolve } from 'node:path';

import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const workspaceEnvironment = loadEnv(mode, resolve(__dirname, '../..'), '');

  return {
    define: {
      __EXTENSION_API_URL__: JSON.stringify(
        workspaceEnvironment.EXTENSION_API_URL ?? 'http://localhost:3000/api',
      ),
    },
    build: {
      emptyOutDir: true,
      outDir: 'dist',
      rollupOptions: {
        input: {
          background: resolve(__dirname, 'src/background/index.ts'),
          content: resolve(__dirname, 'src/content/index.ts'),
          popup: resolve(__dirname, 'src/popup/index.html'),
          options: resolve(__dirname, 'src/options/index.html'),
        },
        output: {
          entryFileNames: 'assets/[name].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
    },
  };
});
