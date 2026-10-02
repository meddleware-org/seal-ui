import { describe, it, expect, vi, afterEach } from 'vitest'
import { computed, ref } from 'vue'
import { shallowMount } from '@vue/test-utils'

// Mount SealView with its config + wiring modules mocked, so we can drive the active network's
// configuration and assert the gating (the "not available / not configured" notice) without a
// wallet, key-server committee, or Walrus endpoint. shallowMount stubs child components
// (WalletGuard, AppTabNav) but renders SealView's own template, where the gate lives.
async function mountWith(problem: string | null, network = 'testnet', custody: 'independent' | 'operator' = 'independent') {
  vi.resetModules()
  vi.doMock('../src/config.js', () => ({
    network: ref(network),
    activeConfig: computed(() => ({ network, problem, custody, seal: problem ? null : { originalId: '0x1', publishedAt: '0x1' } })),
  }))
  vi.doMock('../src/wallet.js', () => ({
    useWallet: () => ({
      account: ref<string | null>(null),
      signPersonalMessage: vi.fn(),
      signAndExecute: vi.fn(),
    }),
    getSuiClient: () => ({}),
  }))
  vi.doMock('../src/seal.js', () => ({
    registry: computed(() => ({ list: () => [] })),
    getSealController: vi.fn(),
    clearSealSessions: vi.fn(),
  }))
  vi.doMock('../src/walrus.js', () => ({ storeBlob: vi.fn(), readBlob: vi.fn() }))
  vi.doMock('../src/sealed-content.js', () => ({ discoverSealedContent: vi.fn() }))
  const { default: SealView } = await import('../src/components/SealView.vue')
  return shallowMount(SealView)
}

afterEach(() => vi.resetModules())

describe('SealView network gating', () => {
  // The notice sits outside WalletGuard and is bound to `activeConfig.problem`, so its presence is
  // the wallet-independent gating signal. (The encrypt controls live behind the connect prompt.)
  it('shows why sealing is unavailable on the active network', async () => {
    const w = await mountWith('Sealed Storage is not available on mainnet: no seal_policies deployment is recorded for it.', 'mainnet')
    expect(w.find('.notice--warn').exists()).toBe(true)
    expect(w.text()).toContain('not available on mainnet')
  })

  it('shows a configuration problem', async () => {
    const w = await mountWith('Sealed Storage is not configured on localnet: set VITE_SEAL_SERVER_OBJECT_IDS_LOCALNET', 'localnet')
    expect(w.text()).toContain('VITE_SEAL_SERVER_OBJECT_IDS_LOCALNET')
  })

  it('hides the notice when configured', async () => {
    const w = await mountWith(null)
    expect(w.find('.notice--warn').exists()).toBe(false)
  })

  it('warns that the operator could decrypt when its own key server is in use', async () => {
    const w = await mountWith(null, 'mainnet', 'operator')
    expect(w.find('.notice--warn').exists()).toBe(true)
    expect(w.text()).toContain("run by this site's operator, who could therefore decrypt it")
  })

  it('shows no custody notice for independent key servers', async () => {
    const w = await mountWith(null, 'mainnet', 'independent')
    expect(w.text()).not.toContain('could therefore decrypt')
  })
})
