import { describe, it, expect } from 'vitest'
import { thresholdError } from '../src/config.js'

describe('thresholdError', () => {
  const one = [{ weight: 1 }]
  const three = [{ weight: 1 }, { weight: 1 }, { weight: 1 }]

  it('accepts a threshold within the total server weight', () => {
    expect(thresholdError(1, one)).toBeNull()
    expect(thresholdError(2, three)).toBeNull()
  })

  it('rejects the old mainnet default of 5 against a single committee', () => {
    expect(thresholdError(5, one)).toMatch(/\[1, 1\]/)
  })

  it('rejects zero, fractions and NaN', () => {
    expect(thresholdError(0, three)).not.toBeNull()
    expect(thresholdError(1.5, three)).not.toBeNull()
    expect(thresholdError(Number.NaN, three)).not.toBeNull()
  })
})

describe('sealConfig', () => {
  it('takes the package ids from the deployments and the testnet committee defaults', async () => {
    const { sealConfig } = await import('../src/config.js')
    const { sealPoliciesDeployment } = await import('@meddleware/seal-client/deployments')
    const { accessGateDeployment } = await import('@meddleware/access-gate-client/deployments')
    const c = sealConfig('testnet', {})
    expect(c.seal).toEqual(sealPoliciesDeployment('testnet'))
    expect(c.accessGateOriginalId).toBe(accessGateDeployment('testnet').originalId)
    expect(c.servers).toHaveLength(3)
    expect(c.servers[0].aggregatorUrl).toBe('https://seal-aggregator-testnet.mystenlabs.com')
    expect(c.threshold).toBe(2)
    expect(c.walrusPublisher).toBe('https://publisher.walrus-testnet.walrus.space')
    expect(c.problem).toBeNull()
  })

  it('reports a network without a seal_policies deployment', async () => {
    const { sealConfig } = await import('../src/config.js')
    const c = sealConfig('mainnet', {})
    expect(c.seal).toBeNull()
    expect(c.problem).toMatch(/not available on mainnet/)
    expect(c.walrusPublisher).toBe('') // no public mainnet publisher
  })

  it('reads per-network overrides of servers and threshold', async () => {
    const { sealConfig } = await import('../src/config.js')
    const c = sealConfig('testnet', {
      VITE_SEAL_SERVER_OBJECT_IDS_TESTNET: '0xa,0xb',
      VITE_SEAL_AGGREGATOR_URLS_TESTNET: 'https://agg.example',
      VITE_SEAL_THRESHOLD_TESTNET: '1',
      VITE_WALRUS_PUBLISHER_TESTNET: 'https://pub.example',
    })
    expect(c.servers).toEqual([
      { objectId: '0xa', weight: 1, aggregatorUrl: 'https://agg.example' },
      { objectId: '0xb', weight: 1, aggregatorUrl: undefined },
    ])
    expect(c.threshold).toBe(1)
    expect(c.walrusPublisher).toBe('https://pub.example')
  })

  it('reports a threshold the committee cannot meet', async () => {
    const { sealConfig } = await import('../src/config.js')
    expect(sealConfig('testnet', { VITE_SEAL_THRESHOLD_TESTNET: '5' }).problem).toMatch(/\[1, 3\]/)
  })

  it('reports a network with no committee', async () => {
    const { sealConfig } = await import('../src/config.js')
    expect(sealConfig('localnet', {}).problem).toMatch(/not available on localnet/)
  })

  it('mainnet defaults to three independent Open-mode servers at threshold 2 (ADR-0002, D24)', async () => {
    const { sealConfig } = await import('../src/config.js')
    const c = sealConfig('mainnet', {})
    expect(c.servers.map((x) => x.objectId)).toEqual([
      '0x145540d931f182fef76467dd8074c9839aea126852d90d18e1556fcbbd1208b6',
      '0x1afb3a57211ceff8f6781757821847e3ddae73f64e78ec8cd9349914ad985475',
      '0x4a65b4ff7ba8f4b538895ee35959f982a95f0db7e2a202ec989d261ea927286a',
    ])
    expect(c.servers.every((x) => x.aggregatorUrl === undefined)).toBe(true)
    expect(c.threshold).toBe(2)
    expect(c.custody).toBe('independent')
  })

  it('never configures an API key, even when one is supplied (it would ship in the bundle)', async () => {
    const { sealConfig } = await import('../src/config.js')
    for (const net of ['testnet', 'mainnet']) {
      const NET = net.toUpperCase()
      const c = sealConfig(net, { [`VITE_SEAL_AGGREGATOR_API_KEY_${NET}`]: 'leaked' })
      for (const server of c.servers) {
        expect(server).not.toHaveProperty('apiKey')
        expect(server).not.toHaveProperty('apiKeyName')
      }
    }
  })

  it('reports operator custody and rejects an unknown custody value', async () => {
    const { sealConfig } = await import('../src/config.js')
    const op = sealConfig('testnet', { VITE_SEAL_KEY_CUSTODY_TESTNET: 'operator' })
    expect(op.custody).toBe('operator')
    expect(op.problem).toBeNull()
    expect(sealConfig('testnet', {}).custody).toBe('independent')
    const bad = sealConfig('testnet', { VITE_SEAL_KEY_CUSTODY_TESTNET: 'mine' })
    expect(bad.problem).toMatch(/VITE_SEAL_KEY_CUSTODY_TESTNET must be "independent" or "operator"/)
  })
})
