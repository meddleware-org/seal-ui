// Build-time configuration (Vite inlines VITE_* at build). All values are baked into the static
// bundle via Docker --build-arg. See Dockerfile for the full list.
import type { KeyServerConfig } from '@meddleware/seal-client'

export type Network = 'testnet' | 'mainnet'

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {}

export const NETWORK: Network = (env.VITE_NETWORK as Network) || 'testnet'

/** Read a per-network var, e.g. netEnv('VITE_SEAL_PACKAGE_ID') → VITE_SEAL_PACKAGE_ID_TESTNET. */
function netEnv(base: string): string | undefined {
  return env[`${base}_${NETWORK.toUpperCase()}`]
}

function csv(v: string | undefined): string[] {
  return (v ?? '').split(',').map((s) => s.trim()).filter(Boolean)
}

export const RPC_URLS: Record<Network, string> = {
  testnet: env.VITE_RPC_TESTNET || 'https://fullnode.testnet.sui.io:443',
  mainnet: env.VITE_RPC_MAINNET || 'https://fullnode.mainnet.sui.io:443',
}

/** Published `seal_policies` package id for this network (required to encrypt/decrypt). */
export const SEAL_PACKAGE_ID: string =
  netEnv('VITE_SEAL_PACKAGE_ID') ||
  // Meddleware's canonical testnet deployment — override with VITE_SEAL_PACKAGE_ID_TESTNET
  (NETWORK === 'testnet'
    ? '0x42cc181f851ef702c1fddc9b925553f03b71784edff49d80fbc260055f86d612'
    : '')

/**
 * Threshold `t` over the configured servers. A committee reached through an aggregator counts as
 * ONE server (its own t-of-n is enforced internally).
 *   Testnet default: 2 (the Mysten committee + two independent open servers)
 *   Mainnet default: 1 (the verified Mysten 5-of-8 committee behind the mainnet aggregator)
 */
export const SEAL_THRESHOLD = Number(
  env.VITE_SEAL_THRESHOLD || (NETWORK === 'mainnet' ? '1' : '2'),
)

/**
 * The key-server committee. Object ids and aggregator URLs are supplied as parallel CSV lists
 * (index-aligned); aggregatorUrl is required for decentralized (committee-type) servers only —
 * independent servers derive their URL from the on-chain object and do not need one.
 *
 * Testnet defaults — three verified Mysten Labs servers:
 *   [0] Decentralized (Mysten aggregator) — requires aggregatorUrl
 *   [1] Independent server 1
 *   [2] Independent server 2
 * Override via VITE_SEAL_SERVER_OBJECT_IDS_TESTNET / VITE_SEAL_AGGREGATOR_URLS_TESTNET.
 *
 * Mainnet defaults — Mysten Labs 5-of-8 decentralized committee:
 *   Committee object: 0x686098f1439237fff9f36b99c7329683c22979d2005c2465cb891acb012a7595
 *   Aggregator: https://seal-aggregator-mainnet.mystenlabs.com
 *   The mainnet aggregator requires an Enoki API key, sent as the `X-API-Key` header on requests to
 *   aggregator-backed servers. Set VITE_SEAL_AGGREGATOR_API_KEY_MAINNET (a publishable client key —
 *   it is baked into the static bundle, so scope it to Seal in the Enoki portal).
 *   Override via VITE_SEAL_SERVER_OBJECT_IDS_MAINNET / VITE_SEAL_AGGREGATOR_URLS_MAINNET.
 *   When independent open-mode key servers become available on mainnet, they can be added here.
 */
export const SEAL_SERVERS: KeyServerConfig[] = (() => {
  const defaults: Record<Network, { ids: string[]; aggs: string[] }> = {
    testnet: {
      ids: [
        '0xb012378c9f3799fb5b1a7083da74a4069e3c3f1c93de0b27212a5799ce1e1e98',
        '0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75',
        '0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8',
      ],
      aggs: ['https://seal-aggregator-testnet.mystenlabs.com'],
    },
    mainnet: {
      ids: ['0x686098f1439237fff9f36b99c7329683c22979d2005c2465cb891acb012a7595'],
      aggs: ['https://seal-aggregator-mainnet.mystenlabs.com'],
    },
  }

  const envIds = csv(netEnv('VITE_SEAL_SERVER_OBJECT_IDS'))
  const envAggs = csv(netEnv('VITE_SEAL_AGGREGATOR_URLS'))
  const ids = envIds.length > 0 ? envIds : defaults[NETWORK].ids
  const aggs = envAggs.length > 0 ? envAggs : defaults[NETWORK].aggs
  const apiKey = netEnv('VITE_SEAL_AGGREGATOR_API_KEY')
  return ids.map((objectId, i) => {
    const aggregatorUrl = aggs[i]
    return aggregatorUrl && apiKey
      ? { objectId, weight: 1, aggregatorUrl, apiKeyName: 'X-API-Key', apiKey }
      : { objectId, weight: 1, aggregatorUrl }
  })
})()

/**
 * Fail fast at startup on a threshold no committee could meet (or a non-integer one) instead of
 * at the first decrypt. Returns the error message, or null when the pair is valid.
 */
export function thresholdError(threshold: number, servers: readonly { weight?: number }[]): string | null {
  const total = servers.reduce((sum, s) => sum + (s.weight ?? 1), 0)
  if (servers.length === 0) return null // unconfigured network — reported by SEAL_CONFIGURED instead
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > total) {
    return `VITE_SEAL_THRESHOLD must be an integer in [1, ${total}] for ${servers.length} configured server(s); got ${threshold}`
  }
  return null
}

const THRESHOLD_ERROR = thresholdError(SEAL_THRESHOLD, SEAL_SERVERS)
if (THRESHOLD_ERROR) throw new Error(`seal-ui: ${THRESHOLD_ERROR}`)

/**
 * Walrus HTTP publisher for storing the opaque ciphertext blob. Walrus runs no public publisher on
 * mainnet (a publisher pays SUI + WAL itself), so mainnet has NO default: set
 * VITE_WALRUS_PUBLISHER_MAINNET to an operator-run authenticated publisher, or storing fails with
 * a clear error.
 */
export const WALRUS_PUBLISHER: string =
  netEnv('VITE_WALRUS_PUBLISHER') ||
  (NETWORK === 'mainnet' ? '' : 'https://publisher.walrus-testnet.walrus.space')

/** Walrus HTTP aggregator for reading ciphertext back (Mysten reference endpoints). */
export const WALRUS_AGGREGATOR: string =
  netEnv('VITE_WALRUS_AGGREGATOR') ||
  (NETWORK === 'mainnet'
    ? 'https://aggregator.walrus-mainnet.walrus.space'
    : 'https://aggregator.walrus-testnet.walrus.space')

/**
 * Largest ciphertext the app sends to the publisher. Public publishers cap requests at 10 MiB;
 * an operator-run publisher may allow more via VITE_WALRUS_MAX_UPLOAD_BYTES.
 */
export const WALRUS_MAX_UPLOAD_BYTES = Number(env.VITE_WALRUS_MAX_UPLOAD_BYTES || String(10 * 1024 * 1024))

/** Default blob lifetime (Walrus storage epochs). */
export const WALRUS_EPOCHS = Number(env.VITE_WALRUS_EPOCHS || '5')

/**
 * Meddleware's deployed `access_gate` package IDs per network.
 * Used by the nft-gate provider's `suggest()` to list AdminCap-owned gates for the connected wallet.
 * Kept in sync with access-gate-ui/src/constants.ts (same deployment).
 */
export const ACCESS_GATE_PACKAGE_ID: Record<Network, string> = {
  testnet: '0x1a81ca177db039585e575beeeee4759466e55910e936a6733e38dbb65025eea4',
  mainnet: '',
}

/** True when the on-chain policy package + committee are configured for the active network. */
export const SEAL_CONFIGURED = Boolean(SEAL_PACKAGE_ID) && SEAL_SERVERS.length > 0

/**
 * True when the active network has no Seal committee configured (empty package ID or no servers).
 * On mainnet, populate VITE_SEAL_PACKAGE_ID_MAINNET + VITE_SEAL_SERVER_OBJECT_IDS_MAINNET +
 * VITE_SEAL_AGGREGATOR_URLS_MAINNET to enable sealing — no code change required.
 */
export const MAINNET_PENDING = !SEAL_CONFIGURED
