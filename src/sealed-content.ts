// Discover on-chain SealedContent pointers for a gate by indexing the SealedContentPublished
// event. Uses the gRPC client's listEvents + a client-side gate_id filter (no indexer needed).
import { sealedContentEventType, type SealedContentPointer } from '@meddleware/seal-client'
import { normalizeSuiAddress } from '@mysten/sui/utils'
import { getSuiClient } from './wallet.js'
import { SEAL_PACKAGE_ID } from './config.js'

/** Most pointers returned for one gate. */
export const MAX_DISCOVERED = 200
/** Page budget per discovery: bounds RPC calls when a gate has few pointers among many events. */
export const MAX_EVENT_PAGES = 20
const PAGE_SIZE = 50 // gRPC servers truncate larger pages silently

interface RawEvent {
  content_id?: string
  gate_id?: string
  blob_id?: string
  seal_id?: string
  label?: string
  publisher?: string
}

/**
 * Published pointers whose `gate_id` matches, newest first. Walks the event stream in descending
 * ledger order until {@link MAX_DISCOVERED} matches are found, the stream ends, or the page budget
 * {@link MAX_EVENT_PAGES} is spent.
 */
export async function discoverSealedContent(gateId: string): Promise<SealedContentPointer[]> {
  if (!SEAL_PACKAGE_ID) throw new Error('Seal policy package is not configured.')
  const client = getSuiClient()
  const target = normalizeSuiAddress(gateId)
  const out: SealedContentPointer[] = []
  let before: string | null = null
  for (let page = 0; page < MAX_EVENT_PAGES && out.length < MAX_DISCOVERED; page++) {
    const res = await client.listEvents({
      filter: { eventType: sealedContentEventType(SEAL_PACKAGE_ID) },
      limit: PAGE_SIZE,
      order: 'descending',
      ...(before ? { before } : {}),
    })
    for (const ev of res.events) {
      const p = ev.json as RawEvent | undefined
      if (!p?.gate_id || normalizeSuiAddress(p.gate_id) !== target) continue
      out.push({
        contentId: p.content_id ?? '',
        gateId: p.gate_id,
        blobId: p.blob_id ?? '',
        sealId: p.seal_id ?? '',
        label: p.label ?? '',
        publisher: p.publisher ?? '',
      })
      if (out.length >= MAX_DISCOVERED) break
    }
    if (!res.hasNextPage || !res.endCursor) break
    before = res.endCursor
  }
  return out
}
