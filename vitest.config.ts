// @ts-nocheck — vitest/config bundles its own Vite copy causing plugin type conflicts with @vitejs/plugin-react
// This file is not included in tsconfig.node.json; type-correctness is verified at runtime.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
});
