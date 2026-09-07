// Thin seal-ui shim over the shared @meddleware/wallet-adapter singleton.
//
// The adapter is network-agnostic (RPC URL passed per call); this shim binds seal-ui's RPC_URLS
// so call sites keep the ergonomics (`getSuiClient()` defaulting to the active network,
// `signAndExecute(tx)`). Because the adapter is a module singleton, the wallet connection is
// shared with any other tool view rendered in the same window (e.g. the dashboard).
import {
  useWallet as useWalletBase,
  getSuiClient as getSuiClientBase,
  buildExecutor as buildExecutorBase,
} from '@meddleware/wallet-adapter'
import type { Transaction } from '@mysten/sui/transactions'
import { NETWORK, RPC_URLS, type Network } from './config.js'

/** Memoised Sui JSON-RPC client for the network (defaults to the active network). */
export function getSuiClient(network: Network = NETWORK) {
  return getSuiClientBase(network, RPC_URLS[network])
}

/** Sign a personal message with the connected wallet (mints a Seal SessionKey). */
export function signPersonalMessage(message: Uint8Array): Promise<{ signature: string }> {
  return useWalletBase().signPersonalMessage(message)
}

/** Sign + execute a PTB with the connected wallet, returning the transaction digest. */
export async function signAndExecute(
  tx: Transaction,
  network: Network = NETWORK,
): Promise<{ digest: string }> {
  const executor = await buildExecutorBase(network, RPC_URLS[network])
  return executor.signAndExecute(tx)
}

/**
 * Wallet composable bound to seal-ui's network config. Delegates to the shared adapter singleton;
 * Seal needs `sui:signPersonalMessage` (SessionKey) and `sui:signTransaction` (publish pointer),
 * so both are requested for discovery.
 */
export function useWallet() {
  const base = useWalletBase({ requiredFeatures: ['sui:signPersonalMessage', 'sui:signTransaction'] })
  return {
    wallets: base.wallets,
    currentWallet: base.currentWallet,
    account: base.account,
    connecting: base.connecting,
    error: base.error,
    connect: base.connect,
    disconnect: base.disconnect,
    signPersonalMessage,
    signAndExecute,
  }
}
