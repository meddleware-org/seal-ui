// Minimal Sui wallet integration on @mysten/wallet-standard (dapp-kit is React-only).
// Discovers wallets, connects, and signs personal messages (to mint a Seal SessionKey).
// Module singleton. Adapted from walrus-ui/src/wallet.ts.
import { markRaw, readonly, ref, shallowRef } from 'vue'
import { getWallets, isWalletWithRequiredFeatureSet } from '@mysten/wallet-standard'
import type { Wallet, WalletAccount } from '@mysten/wallet-standard'
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc'
import type { Transaction } from '@mysten/sui/transactions'
import { NETWORK, RPC_URLS, type Network } from './config.js'

const REQUIRED_FEATURES = ['standard:connect', 'sui:signPersonalMessage'] as const

const wallets = shallowRef<Wallet[]>([])
const currentWallet = shallowRef<Wallet | null>(null)
const account = shallowRef<WalletAccount | null>(null)
const connecting = ref(false)
const error = ref<string | null>(null)

const clients = new Map<Network, SuiJsonRpcClient>()
/** Memoised {@link SuiJsonRpcClient} per network (one instance each). */
export function getSuiClient(network: Network = NETWORK): SuiJsonRpcClient {
  let c = clients.get(network)
  if (!c) {
    c = new SuiJsonRpcClient({ url: RPC_URLS[network], network })
    clients.set(network, c)
  }
  return c
}

function refreshWallets(): void {
  // markRaw: extension Wallet objects expose getters that throw through a Vue reactive Proxy.
  wallets.value = getWallets()
    .get()
    .filter((w) => isWalletWithRequiredFeatureSet(w, [...REQUIRED_FEATURES]))
    .map((w) => markRaw(w))
}

let initialised = false
function init(): void {
  if (initialised) return
  initialised = true
  const api = getWallets()
  refreshWallets()
  api.on('register', refreshWallets)
  api.on('unregister', refreshWallets)
}

async function connect(wallet: Wallet): Promise<void> {
  error.value = null
  connecting.value = true
  try {
    const feature = wallet.features['standard:connect'] as {
      connect: () => Promise<{ accounts: readonly WalletAccount[] }>
    }
    const { accounts } = await feature.connect()
    if (!accounts.length) throw new Error('Wallet returned no accounts.')
    currentWallet.value = markRaw(wallet)
    account.value = markRaw(accounts[0])
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    throw e
  } finally {
    connecting.value = false
  }
}

function disconnect(): void {
  const disc = currentWallet.value?.features['standard:disconnect'] as
    | { disconnect?: () => Promise<void> }
    | undefined
  void disc?.disconnect?.()
  currentWallet.value = null
  account.value = null
}

/** Sign a Seal SessionKey personal message; returns the base64 signature. */
async function signPersonalMessage(message: Uint8Array): Promise<{ signature: string }> {
  const wallet = currentWallet.value
  const acct = account.value
  if (!wallet || !acct) throw new Error('Connect a wallet first.')
  const feature = wallet.features['sui:signPersonalMessage'] as
    | {
        signPersonalMessage: (input: {
          message: Uint8Array
          account: WalletAccount
        }) => Promise<{ bytes: string; signature: string }>
      }
    | undefined
  if (!feature) throw new Error('This wallet cannot sign personal messages.')
  const { signature } = await feature.signPersonalMessage({ message, account: acct })
  return { signature }
}

/** Sign + execute a PTB with the connected wallet, returning the transaction digest. */
async function signAndExecute(tx: Transaction, network: Network = NETWORK): Promise<{ digest: string }> {
  const wallet = currentWallet.value
  const acct = account.value
  if (!wallet || !acct) throw new Error('Connect a wallet first.')
  const client = getSuiClient(network)
  const chain = `sui:${network}` as const
  const feature = wallet.features['sui:signTransaction'] as
    | {
        signTransaction: (input: {
          transaction: Transaction
          account: WalletAccount
          chain: `sui:${string}`
        }) => Promise<{ bytes: string; signature: string }>
      }
    | undefined
  if (!feature) throw new Error('This wallet cannot sign transactions.')
  const { bytes, signature } = await feature.signTransaction({ transaction: tx, account: acct, chain })
  const res = await client.executeTransactionBlock({
    transactionBlock: bytes,
    signature,
    options: { showEffects: true },
  })
  return { digest: res.digest }
}

/**
 * Wallet composable: discovers wallets, exposes reactive connection state, and provides
 * `connect` / `disconnect` / `signPersonalMessage` / `signAndExecute`. Module singleton.
 */
export function useWallet() {
  init()
  return {
    wallets: readonly(wallets),
    currentWallet: readonly(currentWallet),
    account: readonly(account),
    connecting: readonly(connecting),
    error: readonly(error),
    connect,
    disconnect,
    signPersonalMessage,
    signAndExecute,
  }
}
