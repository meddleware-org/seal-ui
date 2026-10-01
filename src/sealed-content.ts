// Discover on-chain SealedContent pointers for a gate with seal-client's `listSealedContent`
// (exact event type at the deployment's original id; BCS-decoded). Reads the read-indexer when
// VITE_INDEXER_URL is set — display data only, falling back to the full node.
import { listSealedContent, type SealedContentPointer } from '@meddleware/seal-client'
import { getSuiClient } from './wallet.js'
import { activeConfig, INDEXER_URL } from './config.js'

/** Most pointers listed for one gate. */
export const MAX_DISCOVERED = 200

/** Published pointers for `gateId` on the active network, newest first. */
export async function discoverSealedContent(gateId: string): Promise<SealedContentPointer[]> {
  const cfg = activeConfig.value
  if (!cfg.seal) throw new Error(cfg.problem ?? `Sealed Storage is not available on ${cfg.network}.`)
  const page = await listSealedContent(getSuiClient(), {
    originalId: cfg.seal.originalId,
    gateId,
    limit: MAX_DISCOVERED,
    indexer: INDEXER_URL ? { url: INDEXER_URL, network: cfg.network } : undefined,
  })
  return page.pointers
}
