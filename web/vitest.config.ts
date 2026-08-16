import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Test-only reach into the sibling lineup-manager checkout (the seed
      // contract's consumer) for the conformance guard — never aliased in
      // vite.config.ts, so app builds cannot import cross-repo.
      '@lineup-manager': fileURLToPath(new URL('../../lineup-manager/src', import.meta.url))
    }
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/__tests__/**/*.test.ts']
  }
})
