import { createApp } from 'vue'
import '@meddleware/design-tokens/tokens.css'
import '@meddleware/design-tokens/seasons.css'
import '@meddleware/ui/base.css'
import './styles.css'
import { loadRuntimeConfig, useSeason } from '@meddleware/ui'
import { useNetwork } from '@meddleware/wallet-adapter'

// The standalone build targets one network; select it in the shared selector so the client, the
// ids, the key servers and the Walrus endpoints all agree. (Embedded, the host's selector rules.)
const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {}
const built = env.VITE_NETWORK || 'testnet'
if (built === 'testnet' || built === 'mainnet') useNetwork().setNetwork(built)

useSeason()
// Machine-zone endpoints (the indexer, the Walrus relays) come from /runtime-config.json when the deployment
// serves one (ADR-0005); load it before any module that reads them is imported.
void loadRuntimeConfig().then(async () => {
  const { default: App } = await import('./App.vue')
  createApp(App).mount('#app')
})
