// Discover on-chain SealedContent pointers for a gate by indexing the SealedContentPublished
// event. Uses the JSON-RPC client's queryEvents + a client-side gate_id filter (no indexer needed).
import { sealedContentEventType, type SealedContentPointer } from '@meddleware/seal-client'
import { getSuiClient } from './wallet.js'
import { SEAL_PACKAGE_ID } from './config.js'

function normId(id: string): string {
  const lower = id.toLowerCase()
  return lower.startsWith('0x') ? lower : `0x${lower}`
}

interface RawEvent {
  content_id?: string
  gate_id?: string
  blob_id?: string
  seal_id?: string
  label?: string
  publisher?: string
}

/** All published pointers whose `gate_id` matches, newest first. */
export async function discoverSealedContent(gateId: string): Promise<SealedContentPointer[]> {
  if (!SEAL_PACKAGE_ID) throw new Error('Seal policy package is not configured.')
  const client = getSuiClient()
  const res = await client.queryEvents({
    query: { MoveEventType: sealedContentEventType(SEAL_PACKAGE_ID) },
    order: 'descending',
    limit: 200,
  })
  const target = normId(gateId)
  const out: SealedContentPointer[] = []
  for (const ev of res.data) {
    const p = ev.parsedJson as RawEvent | undefined
    if (!p?.gate_id || normId(p.gate_id) !== target) continue
    out.push({
      contentId: p.content_id ?? '',
      gateId: p.gate_id,
      blobId: p.blob_id ?? '',
      sealId: p.seal_id ?? '',
      label: p.label ?? '',
      publisher: p.publisher ?? '',
    })
  }
  return out
}
