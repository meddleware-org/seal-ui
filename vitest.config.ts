import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// Unit + component tests. The Vue plugin compiles SFCs for @vue/test-utils mounts; jsdom provides
// the DOM those mounts render into. Pure-logic tests (manifest-guard) run under the same config.
export default defineConfig({
  plugins: [vue()],
  // Keep @vue/test-utils and the compiled SFCs on a single Vue runtime.
  resolve: { dedupe: ['vue', '@vue/test-utils'] },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules/**'],
  },
})
