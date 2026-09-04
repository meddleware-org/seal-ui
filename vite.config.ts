import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// @mysten/seal is pure JS (no wasm). Ciphertext storage uses the Walrus HTTP publisher/aggregator
// (plain fetch), so no @mysten/walrus wasm to exclude here.
export default defineConfig({
  plugins: [vue()],
})
