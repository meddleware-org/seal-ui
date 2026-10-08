// Ciphertext storage via the Walrus HTTP publisher/aggregator (@meddleware/walrus-client/http). The
// blob is opaque (already Seal-encrypted), so no wallet, wasm or @mysten/walrus is involved. This
// module only applies the active network's endpoints and the app's limits.
import { readBlob as readViaAggregator, storeBlobViaPublisher } from '@meddleware/walrus-client/http'
import { activeConfig, WALRUS_EPOCHS, WALRUS_MAX_UPLOAD_BYTES } from './config.js'

/**
 * Store the ciphertext as a permanent blob whose `Blob` object goes to `sendObjectTo` (the user, not
 * the publisher). Returns the blob id.
 */
export async function storeBlob(bytes: Uint8Array, opts: { sendObjectTo: string }): Promise<string> {
  const cfg = activeConfig.value
  if (!cfg.walrusPublisher) {
    throw new Error(
      `No Walrus publisher is configured for ${cfg.network}. Walrus runs no public mainnet publisher; ` +
        `set VITE_WALRUS_PUBLISHER_${cfg.network.toUpperCase()} to an operator-run publisher.`,
    )
  }
  const stored = await storeBlobViaPublisher(bytes, {
    publisher: cfg.walrusPublisher,
    epochs: WALRUS_EPOCHS,
    sendObjectTo: opts.sendObjectTo,
    maxBytes: WALRUS_MAX_UPLOAD_BYTES,
  })
  // Ciphertext carries a random Seal identity, so it cannot already be stored; if a publisher says it
  // is, the user would own no Blob object to extend, so refuse rather than hand back a dead pointer.
  if (stored.kind !== 'newlyCreated') {
    throw new Error('The publisher reported this blob as already stored, so no Blob object was created for you. Try again.')
  }
  return stored.blobId
}

/** Read the ciphertext back, with the aggregator's strict consistency check. */
export function readBlob(blobId: string): Promise<Uint8Array> {
  const cfg = activeConfig.value
  if (!cfg.walrusAggregator) throw new Error(`No Walrus aggregator is configured for ${cfg.network}.`)
  return readViaAggregator(blobId, { aggregator: cfg.walrusAggregator })
}
