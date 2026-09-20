import { describe, it, expect, vi, afterEach } from 'vitest'
import { ref } from 'vue'
import { shallowMount } from '@vue/test-utils'

// Mount SealView with its config + wiring modules mocked, so we can drive SEAL_CONFIGURED and assert
// the network-gating behaviour (the "not configured" notice + disabled encrypt control) without a
// wallet, key-server committee, or Walrus endpoint. shallowMount stubs child components
// (WalletGuard, AppTabNav) but renders SealView's own template, where the gate lives.
async function mountWith(sealConfigured: boolean, network = 'testnet') {
  vi.resetModules()
  vi.doMock('../src/config.js', () => ({
    NETWORK: network,
    SEAL_CONFIGURED: sealConfigured,
    SEAL_PACKAGE_ID: sealConfigured ? '0xpkg' : '',
  }))
  vi.doMock('../src/wallet.js', () => ({
    useWallet: () => ({
      account: ref<string | null>(null),
      signPersonalMessage: vi.fn(),
      signAndExecute: vi.fn(),
    }),
    getSuiClient: () => ({}),
  }))
  vi.doMock('../src/seal.js', () => ({ registry: { list: () => [] }, getSealController: vi.fn() }))
  vi.doMock('../src/walrus.js', () => ({ storeBlob: vi.fn(), readBlob: vi.fn() }))
  vi.doMock('../src/sealed-content.js', () => ({ discoverSealedContent: vi.fn() }))
  const { default: SealView } = await import('../src/components/SealView.vue')
  return shallowMount(SealView)
}

afterEach(() => vi.resetModules())

describe('SealView network gating', () => {
  // The not-configured warning notice sits outside WalletGuard and is bound directly to
  // `v-if="!SEAL_CONFIGURED"`, so its presence/absence is the wallet-independent config-gating
  // signal. (The encrypt controls themselves live behind WalletGuard's connect prompt.)
  it('shows the not-configured notice when SEAL_CONFIGURED is false', async () => {
    const w = await mountWith(false)
    expect(w.find('.notice--warn').exists()).toBe(true)
    expect(w.text()).toContain('no Seal policy package')
  })

  it('shows the mainnet-specific notice on mainnet when unconfigured', async () => {
    const w = await mountWith(false, 'mainnet')
    expect(w.find('.notice--warn').exists()).toBe(true)
    expect(w.text()).toContain('not configured for mainnet')
  })

  it('hides the not-configured notice when configured', async () => {
    const w = await mountWith(true)
    expect(w.find('.notice--warn').exists()).toBe(false)
  })
})
