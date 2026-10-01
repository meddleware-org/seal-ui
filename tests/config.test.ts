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

  it('reads per-network overrides, including the committee API key and threshold', async () => {
    const { sealConfig } = await import('../src/config.js')
    const c = sealConfig('testnet', {
      VITE_SEAL_SERVER_OBJECT_IDS_TESTNET: '0xa,0xb',
      VITE_SEAL_AGGREGATOR_URLS_TESTNET: 'https://agg.example',
      VITE_SEAL_AGGREGATOR_API_KEY_TESTNET: 'k',
      VITE_SEAL_THRESHOLD_TESTNET: '1',
      VITE_WALRUS_PUBLISHER_TESTNET: 'https://pub.example',
    })
    expect(c.servers).toEqual([
      { objectId: '0xa', weight: 1, aggregatorUrl: 'https://agg.example', apiKeyName: 'X-API-Key', apiKey: 'k' },
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
})
