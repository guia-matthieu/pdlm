import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import path from 'path'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: {
      // lib/contenu est server-only : stub pour les tests
      'server-only': path.resolve('./tests/stubs/server-only.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/unit/**/*.spec.ts', 'tests/int/**/*.int.spec.ts'],
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
})
