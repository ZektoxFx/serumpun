import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  // Reads the `@/*` alias from tsconfig.json so there is one source of truth.
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
