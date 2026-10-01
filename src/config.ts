// Configuration. The network is wallet-adapter's shared runtime selector (the standalone build
// selects VITE_NETWORK in main.ts; embedded, the host's selector rules). Everything network-specific
// is resolved for that network:
//   - package ids (seal_policies, access_gate) come from the published `deployments` — never env;
//   - the key-server committee, threshold and Walrus endpoints are operator settings baked in as
//     VITE_*_{NET} build vars, with Mysten defaults where they exist.
import { computed } from 'vue'
import type { KeyServerConfig } from '@meddleware/seal-client'
import { SEAL_POLICIES_DEPLOYMENTS, type SealPoliciesDeployment } from '@meddleware/seal-client/deployments'
import { ACCESS_GATE_DEPLOYMENTS, type AccessGateDeployment } from '@meddleware/access-gate-client/deployments'
import { useNetwork } from '@meddleware/wallet-adapter'

type EnvSource = Record<string, string | undefined>
const env: EnvSource = (import.meta as unknown as { env?: EnvSource }).env ?? {}

/** The active network (read-only ref). */
export const network = useNetwork().network

function csv(v: string | undefined): string[] {
  return (v ?? '').split(',').map((s) => s.trim()).filter(Boolean)
}

/**
 * Mysten key-server defaults. Testnet: the decentralized committee (via its aggregator) plus two
 * independent servers. Mainnet: the verified 5-of-8 committee behind the mainnet aggregator, which
 * needs an Enoki API key (`VITE_SEAL_AGGREGATOR_API_KEY_MAINNET`, a publishable client key scoped
 * to Seal — it is baked into the bundle). A committee counts as ONE server.
 */
const SERVER_DEFAULTS: Record<string, { ids: string[]; aggs: string[]; threshold: number }> = {
  testnet: {
    ids: [
      '0xb012378c9f3799fb5b1a7083da74a4069e3c3f1c93de0b27212a5799ce1e1e98',
      '0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75',
      '0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8',
    ],
    aggs: ['https://seal-aggregator-testnet.mystenlabs.com'],
    threshold: 2,
  },
  mainnet: {
    ids: ['0x686098f1439237fff9f36b99c7329683c22979d2005c2465cb891acb012a7595'],
    aggs: ['https://seal-aggregator-mainnet.mystenlabs.com'],
    threshold: 1,
  },
}

/**
 * Walrus HTTP endpoints. Walrus runs no public publisher on mainnet (a publisher pays SUI + WAL
 * itself), so mainnet has no publisher default: set `VITE_WALRUS_PUBLISHER_MAINNET` to an
 * operator-run authenticated publisher.
 */
const WALRUS_DEFAULTS: Record<string, { publisher: string; aggregator: string }> = {
  testnet: {
    publisher: 'https://publisher.walrus-testnet.walrus.space',
    aggregator: 'https://aggregator.walrus-testnet.walrus.space',
  },
  mainnet: { publisher: '', aggregator: 'https://aggregator.walrus-mainnet.walrus.space' },
}

/**
 * The threshold error for a committee, or null when the pair is valid. A threshold no committee could
 * meet (or a non-integer one) is reported instead of failing at the first decrypt.
 */
export function thresholdError(threshold: number, servers: readonly { weight?: number }[]): string | null {
  const total = servers.reduce((sum, s) => sum + (s.weight ?? 1), 0)
  if (servers.length === 0) return null // no committee — reported as its own problem
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > total) {
    return `The Seal threshold must be an integer in [1, ${total}] for ${servers.length} configured server(s); got ${threshold}`
  }
  return null
}

/** Everything sealing needs on one network. */
export interface SealConfig {
  network: string
  /** The `seal_policies` deployment, or null where none is recorded. */
  seal: SealPoliciesDeployment | null
  /** The `access_gate` original id ('' where none is recorded; gate suggestions are then off). */
  accessGateOriginalId: string
  servers: KeyServerConfig[]
  threshold: number
  walrusPublisher: string
  walrusAggregator: string
  /** Why sealing is unavailable on this network, or null when it is configured. */
  problem: string | null
}

/** Resolve the configuration for `net` (pure; `envSource` is injectable for tests). */
export function sealConfig(net: string, envSource: EnvSource = env): SealConfig {
  const NET = net.toUpperCase()
  const netEnv = (base: string) => envSource[`${base}_${NET}`]
  const seal = (SEAL_POLICIES_DEPLOYMENTS as Record<string, SealPoliciesDeployment>)[net] ?? null
  const accessGate = (ACCESS_GATE_DEPLOYMENTS as Record<string, AccessGateDeployment>)[net] ?? null

  const defaults = SERVER_DEFAULTS[net]
  const envIds = csv(netEnv('VITE_SEAL_SERVER_OBJECT_IDS'))
  const envAggs = csv(netEnv('VITE_SEAL_AGGREGATOR_URLS'))
  const ids = envIds.length ? envIds : (defaults?.ids ?? [])
  const aggs = envAggs.length ? envAggs : (defaults?.aggs ?? [])
  const apiKey = netEnv('VITE_SEAL_AGGREGATOR_API_KEY')
  const servers: KeyServerConfig[] = ids.map((objectId, i) => {
    const aggregatorUrl = aggs[i]
    return aggregatorUrl && apiKey
      ? { objectId, weight: 1, aggregatorUrl, apiKeyName: 'X-API-Key', apiKey }
      : { objectId, weight: 1, aggregatorUrl }
  })
  const rawThreshold = netEnv('VITE_SEAL_THRESHOLD')
  const threshold = rawThreshold ? Number(rawThreshold) : (defaults?.threshold ?? 1)

  const walrus = WALRUS_DEFAULTS[net]
  const problem = !seal
    ? `Sealed Storage is not available on ${net}: no seal_policies deployment is recorded for it.`
    : servers.length === 0
      ? `Sealed Storage is not configured on ${net}: set VITE_SEAL_SERVER_OBJECT_IDS_${NET} (and VITE_SEAL_AGGREGATOR_URLS_${NET} for a committee).`
      : thresholdError(threshold, servers)

  return {
    network: net,
    seal,
    accessGateOriginalId: accessGate?.originalId ?? '',
    servers,
    threshold,
    walrusPublisher: netEnv('VITE_WALRUS_PUBLISHER') || walrus?.publisher || '',
    walrusAggregator: netEnv('VITE_WALRUS_AGGREGATOR') || walrus?.aggregator || '',
    problem,
  }
}

/** The configuration for the active network. */
export const activeConfig = computed(() => sealConfig(network.value))

/**
 * Largest ciphertext the app sends to the publisher. Public publishers cap requests at 10 MiB;
 * an operator-run publisher may allow more via VITE_WALRUS_MAX_UPLOAD_BYTES.
 */
export const WALRUS_MAX_UPLOAD_BYTES = Number(env.VITE_WALRUS_MAX_UPLOAD_BYTES || String(10 * 1024 * 1024))

/** Default blob lifetime (Walrus storage epochs). */
export const WALRUS_EPOCHS = Number(env.VITE_WALRUS_EPOCHS || '5')

/** Optional read-indexer for sealed-content discovery (display data; falls back to the full node). */
export const INDEXER_URL: string = env.VITE_INDEXER_URL || ''
