import { describe, it, expect, vi, afterEach } from 'vitest'

async function load(config: Record<string, unknown>) {
  vi.resetModules()
  vi.doMock('../src/config.js', () => ({
    NETWORK: 'testnet',
    WALRUS_PUBLISHER: 'https://publisher.example.com',
    WALRUS_AGGREGATOR: 'https://aggregator.example.com',
    WALRUS_EPOCHS: 5,
    WALRUS_MAX_UPLOAD_BYTES: 16,
    ...config,
  }))
  return import('../src/walrus.js')
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

const OWNER = '0x' + 'ab'.repeat(32)

describe('storeBlob', () => {
  it('stores permanent, sends the Blob object to the owner, and returns the blob id', async () => {
    const fetchSpy = vi.fn(async () => Response.json({ newlyCreated: { blobObject: { blobId: 'B1' } } }))
    vi.stubGlobal('fetch', fetchSpy)
    const { storeBlob } = await load({})
    expect(await storeBlob(new Uint8Array([1, 2]), { sendObjectTo: OWNER })).toBe('B1')
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [URL, RequestInit]
    expect(url.origin + url.pathname).toBe('https://publisher.example.com/v1/blobs')
    expect(url.searchParams.get('epochs')).toBe('5')
    expect(url.searchParams.get('permanent')).toBe('true')
    expect(url.searchParams.get('send_object_to')).toBe(OWNER)
    expect(init.method).toBe('PUT')
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('fails clearly when no publisher is configured (mainnet has no public one)', async () => {
    const { storeBlob } = await load({ NETWORK: 'mainnet', WALRUS_PUBLISHER: '' })
    await expect(storeBlob(new Uint8Array([1]), { sendObjectTo: OWNER })).rejects.toThrow(
      /VITE_WALRUS_PUBLISHER_MAINNET/,
    )
  })

  it('refuses a ciphertext over the upload cap before any request', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const { storeBlob } = await load({})
    await expect(storeBlob(new Uint8Array(17), { sendObjectTo: OWNER })).rejects.toThrow(/at most 16/)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('refuses a plain-http publisher', async () => {
    const { storeBlob } = await load({ WALRUS_PUBLISHER: 'http://publisher.example.com' })
    await expect(storeBlob(new Uint8Array([1]), { sendObjectTo: OWNER })).rejects.toThrow(/https/)
  })
})

describe('readBlob', () => {
  it('asks the aggregator for a strict consistency check', async () => {
    const fetchSpy = vi.fn(async () => new Response(new Uint8Array([7])))
    vi.stubGlobal('fetch', fetchSpy)
    const { readBlob } = await load({})
    expect(await readBlob('abc/def')).toEqual(new Uint8Array([7]))
    const [url] = fetchSpy.mock.calls[0] as unknown as [URL]
    expect(url.pathname).toBe('/v1/blobs/abc%2Fdef')
    expect(url.searchParams.get('strict_consistency_check')).toBe('true')
  })
})
