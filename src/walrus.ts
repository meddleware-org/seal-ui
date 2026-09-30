// Ciphertext storage via the Walrus HTTP publisher/aggregator. The blob is opaque (already
// Seal-encrypted), so we need no wallet, no wasm, and no @mysten/walrus SDK here — just fetch.
// (Routing uploads through the Meddleware relay to capture the tip/commission is a documented
// follow-up; see the Sealed Storage plan.)
import { NETWORK, WALRUS_PUBLISHER, WALRUS_AGGREGATOR, WALRUS_EPOCHS, WALRUS_MAX_UPLOAD_BYTES } from './config.js'

const STORE_TIMEOUT_MS = 120_000
const READ_TIMEOUT_MS = 60_000

interface PublishResponse {
  newlyCreated?: { blobObject?: { blobId?: string } }
  alreadyCertified?: { blobId?: string }
}

/** Parse an endpoint and require https (http only for a local endpoint in development). */
export function requireHttpsEndpoint(raw: string, what: string): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`${what} URL is not valid: ${raw}`)
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]'
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) {
    throw new Error(`${what} must use https: ${url.origin}`)
  }
  return url
}

export interface StoreOptions {
  /** Storage epochs (default {@link WALRUS_EPOCHS}). */
  epochs?: number
  /** Sui address that receives the created `Blob` object (the connected wallet). */
  sendObjectTo: string
}

/**
 * Store bytes on Walrus through the configured publisher; returns the blob id. The blob is stored
 * permanent (discovery pointers and manifests rely on it staying readable until expiry) and its
 * `Blob` object is sent to `sendObjectTo`, so the user — not the publisher — owns it.
 */
export async function storeBlob(bytes: Uint8Array, opts: StoreOptions): Promise<string> {
  if (!WALRUS_PUBLISHER) {
    throw new Error(
      `No Walrus publisher is configured for ${NETWORK}. Walrus runs no public mainnet publisher; ` +
        `set VITE_WALRUS_PUBLISHER_${NETWORK.toUpperCase()} to an operator-run publisher.`,
    )
  }
  if (bytes.length > WALRUS_MAX_UPLOAD_BYTES) {
    throw new Error(
      `The encrypted file is ${bytes.length} bytes; the publisher accepts at most ${WALRUS_MAX_UPLOAD_BYTES}.`,
    )
  }
  const url = new URL('/v1/blobs', requireHttpsEndpoint(WALRUS_PUBLISHER, 'Walrus publisher'))
  url.searchParams.set('epochs', String(opts.epochs ?? WALRUS_EPOCHS))
  url.searchParams.set('permanent', 'true')
  url.searchParams.set('send_object_to', opts.sendObjectTo)
  const res = await fetch(url, {
    method: 'PUT',
    body: bytes as BodyInit,
    signal: AbortSignal.timeout(STORE_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`Walrus publisher error ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const json = (await res.json()) as PublishResponse
  const blobId = json.newlyCreated?.blobObject?.blobId ?? json.alreadyCertified?.blobId
  if (!blobId) throw new Error('Walrus publisher returned no blob id.')
  return blobId
}

/**
 * Read bytes back from Walrus by blob id. `strict_consistency_check` makes the aggregator verify
 * the blob was encoded consistently before serving it.
 */
export async function readBlob(blobId: string): Promise<Uint8Array> {
  const url = new URL(
    `/v1/blobs/${encodeURIComponent(blobId)}`,
    requireHttpsEndpoint(WALRUS_AGGREGATOR, 'Walrus aggregator'),
  )
  url.searchParams.set('strict_consistency_check', 'true')
  const res = await fetch(url, { signal: AbortSignal.timeout(READ_TIMEOUT_MS) })
  if (!res.ok) throw new Error(`Walrus aggregator error ${res.status}`)
  return new Uint8Array(await res.arrayBuffer())
}
