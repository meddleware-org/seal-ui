import { describe, it, expect, vi, afterEach } from 'vitest'
import { computed } from 'vue'

// The wrapper applies the active network's endpoints and the app's limits to
// @meddleware/walrus-client/http (whose own behaviour is tested there).
async function load(cfg: { network?: string; walrusPublisher?: string; walrusAggregator?: string }) {
  vi.resetModules()
  vi.doMock('../src/config.js', () => ({
    activeConfig: computed(() => ({
      network: 'testnet',
      walrusPublisher: 'https://publisher.example.com',
      walrusAggregator: 'https://aggregator.example.com',
      ...cfg,
    })),
    WALRUS_EPOCHS: 5,
    WALRUS_MAX_UPLOAD_BYTES: 16,
  }))
  return import('../src/walrus.js')
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

const OWNER = '0x' + 'ab'.repeat(32)

describe('storeBlob', () => {
  it('stores permanent at the network publisher, sends the Blob object to the owner', async () => {
    const fetchSpy = vi.fn(async () => Response.json({ newlyCreated: { blobObject: { blobId: 'B1' } } }))
    vi.stubGlobal('fetch', fetchSpy)
    const { storeBlob } = await load({})
    expect(await storeBlob(new Uint8Array([1, 2]), { sendObjectTo: OWNER })).toBe('B1')
    const [url] = fetchSpy.mock.calls[0] as unknown as [URL]
    expect(url.origin + url.pathname).toBe('https://publisher.example.com/v1/blobs')
    expect(url.searchParams.get('epochs')).toBe('5')
    expect(url.searchParams.get('permanent')).toBe('true')
    expect(url.searchParams.get('send_object_to')).toBe(OWNER)
  })

  it('refuses an already-certified answer: the user would own no Blob object', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ alreadyCertified: { blobId: 'B2', endEpoch: 9 } })))
    const { storeBlob } = await load({})
    await expect(storeBlob(new Uint8Array([1]), { sendObjectTo: OWNER })).rejects.toThrow(/already stored/)
  })

  it('fails clearly when the network has no publisher (mainnet has no public one)', async () => {
    const { storeBlob } = await load({ network: 'mainnet', walrusPublisher: '' })
    await expect(storeBlob(new Uint8Array([1]), { sendObjectTo: OWNER })).rejects.toThrow(/VITE_WALRUS_PUBLISHER_MAINNET/)
  })

  it('refuses a ciphertext over the upload cap before any request', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const { storeBlob } = await load({})
    await expect(storeBlob(new Uint8Array(17), { sendObjectTo: OWNER })).rejects.toThrow(/at most 16/)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('readBlob', () => {
  it('reads from the network aggregator with a strict consistency check', async () => {
    const fetchSpy = vi.fn(async () => new Response(new Uint8Array([7])))
    vi.stubGlobal('fetch', fetchSpy)
    const { readBlob } = await load({})
    expect(await readBlob('abc')).toEqual(new Uint8Array([7]))
    const [url] = fetchSpy.mock.calls[0] as unknown as [URL]
    expect(url.origin).toBe('https://aggregator.example.com')
    expect(url.searchParams.get('strict_consistency_check')).toBe('true')
  })
})
