import { describe, it, expect, vi, afterEach } from 'vitest'
import { computed } from 'vue'

// Discovery delegates to seal-client's listSealedContent (tested there); this checks the wrapper
// passes the active deployment, the gate, the cap and the optional indexer.
const { listSealedContent } = vi.hoisted(() => ({ listSealedContent: vi.fn() }))

async function load(cfg: Record<string, unknown>, indexer = '') {
  vi.resetModules()
  vi.doMock('@meddleware/seal-client', () => ({ listSealedContent }))
  vi.doMock('../src/wallet.js', () => ({ getSuiClient: () => ({ client: true }) }))
  vi.doMock('../src/config.js', () => ({ activeConfig: computed(() => cfg), INDEXER_URL: indexer }))
  return import('../src/sealed-content.js')
}

afterEach(() => {
  listSealedContent.mockReset()
  vi.resetModules()
})

describe('discoverSealedContent', () => {
  it('lists the gate\'s pointers at the deployment\'s original id', async () => {
    listSealedContent.mockResolvedValue({ pointers: [{ label: 'a' }], cursor: null, source: 'rpc' })
    const { discoverSealedContent, MAX_DISCOVERED } = await load({ network: 'testnet', seal: { originalId: '0x42', publishedAt: '0x43' } })
    expect(await discoverSealedContent('0xgate')).toEqual([{ label: 'a' }])
    expect(listSealedContent).toHaveBeenCalledWith({ client: true }, { originalId: '0x42', gateId: '0xgate', limit: MAX_DISCOVERED, indexer: undefined })
  })

  it('reads the indexer for the active network when configured', async () => {
    listSealedContent.mockResolvedValue({ pointers: [], cursor: null, source: 'indexer' })
    const { discoverSealedContent } = await load({ network: 'testnet', seal: { originalId: '0x42', publishedAt: '0x42' } }, 'https://i.example')
    await discoverSealedContent('0xgate')
    expect(listSealedContent.mock.calls[0][1].indexer).toEqual({ url: 'https://i.example', network: 'testnet' })
  })

  it('explains a network without a deployment', async () => {
    const { discoverSealedContent } = await load({ network: 'mainnet', seal: null, problem: 'not available on mainnet' })
    await expect(discoverSealedContent('0xgate')).rejects.toThrow('not available on mainnet')
  })
})
