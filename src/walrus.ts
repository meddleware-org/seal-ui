// Ciphertext storage via the Walrus HTTP publisher/aggregator. The blob is opaque (already
// Seal-encrypted), so we need no wallet, no wasm, and no @mysten/walrus SDK here — just fetch.
// (Routing uploads through the Meddleware relay to capture the tip/commission is a documented
// follow-up; see the Sealed Storage plan.)
import { WALRUS_PUBLISHER, WALRUS_AGGREGATOR, WALRUS_EPOCHS } from './config.js'

interface PublishResponse {
  newlyCreated?: { blobObject?: { blobId?: string } }
  alreadyCertified?: { blobId?: string }
}

/** Store bytes on Walrus; returns the blob id. */
export async function storeBlob(bytes: Uint8Array, epochs = WALRUS_EPOCHS): Promise<string> {
  const res = await fetch(`${WALRUS_PUBLISHER}/v1/blobs?epochs=${epochs}`, {
    method: 'PUT',
    body: bytes as BodyInit,
  })
  if (!res.ok) throw new Error(`Walrus publisher error ${res.status}: ${await res.text()}`)
  const json = (await res.json()) as PublishResponse
  const blobId = json.newlyCreated?.blobObject?.blobId ?? json.alreadyCertified?.blobId
  if (!blobId) throw new Error('Walrus publisher returned no blob id.')
  return blobId
}

/** Read bytes back from Walrus by blob id. */
export async function readBlob(blobId: string): Promise<Uint8Array> {
  const res = await fetch(`${WALRUS_AGGREGATOR}/v1/blobs/${encodeURIComponent(blobId)}`)
  if (!res.ok) throw new Error(`Walrus aggregator error ${res.status}`)
  return new Uint8Array(await res.arrayBuffer())
}
