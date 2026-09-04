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
    ? '0x9f0563bfe42fbd29932cd280cc47efe17f5339b4dc569eb110114665eecc231e'
    : '')

/** Threshold `t` in the t-of-n committee (default 2). */
export const SEAL_THRESHOLD = Number(env.VITE_SEAL_THRESHOLD || '2')

/**
 * The key-server committee. Object ids and aggregator URLs are supplied as parallel CSV lists
 * (index-aligned); aggregatorUrl is required for committee-mode servers.
 */
export const SEAL_SERVERS: KeyServerConfig[] = (() => {
  const ids = csv(netEnv('VITE_SEAL_SERVER_OBJECT_IDS'))
  const aggs = csv(netEnv('VITE_SEAL_AGGREGATOR_URLS'))
  return ids.map((objectId, i) => ({ objectId, weight: 1, aggregatorUrl: aggs[i] }))
})()

/** Walrus HTTP publisher/aggregator for storing/reading the opaque ciphertext blob. */
export const WALRUS_PUBLISHER: string =
  netEnv('VITE_WALRUS_PUBLISHER') ||
  (NETWORK === 'mainnet'
    ? 'https://publisher.walrus.space'
    : 'https://publisher.walrus-testnet.walrus.space')

export const WALRUS_AGGREGATOR: string =
  netEnv('VITE_WALRUS_AGGREGATOR') ||
  (NETWORK === 'mainnet'
    ? 'https://aggregator.walrus.space'
    : 'https://aggregator.walrus-testnet.walrus.space')

/** Default blob lifetime (Walrus storage epochs). */
export const WALRUS_EPOCHS = Number(env.VITE_WALRUS_EPOCHS || '5')

/**
 * Seal committee mode is testnet-only today. On mainnet the app shows a "pending" notice and
 * disables sealing until the committee is available there.
 */
export const MAINNET_PENDING = NETWORK === 'mainnet'

/** True when the on-chain policy package + committee are configured for the active network. */
export const SEAL_CONFIGURED = Boolean(SEAL_PACKAGE_ID) && SEAL_SERVERS.length > 0
