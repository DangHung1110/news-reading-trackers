import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: {
    __EXTENSION_API_URL__: JSON.stringify('http://localhost:3000/api'),
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
