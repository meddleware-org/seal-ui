import { describe, it, expect, vi, afterEach } from 'vitest'

const GATE = '0x' + '0'.repeat(62) + 'ab'

function ev(gate: string, label: string) {
  return { json: { gate_id: gate, content_id: `c-${label}`, blob_id: 'b', seal_id: 's', label, publisher: '0x1' } }
}

async function load(listEvents: ReturnType<typeof vi.fn>) {
  vi.resetModules()
  vi.doMock('../src/config.js', () => ({ SEAL_PACKAGE_ID: '0x42' }))
  vi.doMock('../src/wallet.js', () => ({ getSuiClient: () => ({ listEvents }) }))
  return import('../src/sealed-content.js')
}

afterEach(() => vi.resetModules())

describe('discoverSealedContent', () => {
  it('walks pages newest-first and matches gate ids in any hex form', async () => {
    const listEvents = vi
      .fn()
      .mockResolvedValueOnce({ events: [ev('0xAB', 'newest'), ev('0xcd', 'other')], hasNextPage: true, endCursor: 'C1' })
      .mockResolvedValueOnce({ events: [ev(GATE, 'older')], hasNextPage: false, endCursor: 'C2' })
    const { discoverSealedContent } = await load(listEvents)
    const found = await discoverSealedContent('ab')
    expect(found.map((p) => p.label)).toEqual(['newest', 'older'])
    expect(listEvents.mock.calls[0][0]).toMatchObject({ order: 'descending' })
    expect(listEvents.mock.calls[0][0]).not.toHaveProperty('before')
    expect(listEvents.mock.calls[1][0]).toMatchObject({ order: 'descending', before: 'C1' })
  })

  it('stops at the page budget even when more pages exist', async () => {
    const listEvents = vi.fn(async () => ({ events: [], hasNextPage: true, endCursor: 'C' }))
    const { discoverSealedContent, MAX_EVENT_PAGES } = await load(listEvents)
    expect(await discoverSealedContent(GATE)).toEqual([])
    expect(listEvents).toHaveBeenCalledTimes(MAX_EVENT_PAGES)
  })
})
