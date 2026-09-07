// Thin seal-ui shim over the shared @meddleware/wallet-adapter singleton.
//
// RPC URL is resolved from the runtime useNetwork() singleton so network switching
// in the dashboard propagates immediately to all tool views. Because the adapter is a
// module singleton, the wallet connection is shared with any other tool view rendered
// in the same window (e.g. the dashboard).
import {
  useWallet as useWalletBase,
  getSuiClient as getSuiClientBase,
  buildExecutor as buildExecutorBase,
  useNetwork,
} from '@meddleware/wallet-adapter'
import type { Transaction } from '@mysten/sui/transactions'

const { network, rpcUrl } = useNetwork()

/** Memoised Sui gRPC client for the currently selected network. */
export function getSuiClient() {
  return getSuiClientBase(network.value, rpcUrl.value)
}

/** Sign a personal message with the connected wallet (mints a Seal SessionKey). */
export function signPersonalMessage(message: Uint8Array): Promise<{ signature: string }> {
  return useWalletBase().signPersonalMessage(message)
}

/** Sign + execute a PTB with the connected wallet, returning the transaction digest. */
export async function signAndExecute(tx: Transaction): Promise<{ digest: string }> {
  const executor = await buildExecutorBase(network.value, rpcUrl.value)
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
