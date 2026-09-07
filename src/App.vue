<script setup lang="ts">
// Standalone shell for the Sealed Storage SPA: app header + footer wrapping the core tool view.
// The core UI lives in SealView.vue (also exported for inline embedding in the dashboard).
import { AppHeader, AppFooter, ColorModeControl, useColorMode } from '@meddleware/ui'
import { NETWORK } from './config.js'
import SealView from './components/SealView.vue'

const { mode, set } = useColorMode('dark')
</script>

<template>
  <div class="app">
    <AppHeader variant="dark">
      <template #brand>
        <span>🔒 Sealed Storage</span>
      </template>
      <template #actions>
        <span class="badge">{{ NETWORK }}</span>
        <ColorModeControl :model-value="mode" @update:model-value="set" />
      </template>
    </AppHeader>

    <SealView />

    <AppFooter />
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.badge {
  font-size: 0.75rem;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  background: var(--surface);
  color: var(--muted);
  border: 1px solid var(--border);
}
</style>
