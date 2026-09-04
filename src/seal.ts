// Wires the shared @meddleware/seal-client into this app: one registry (drives the policy picker)
// and one SealController (encrypt/decrypt over the configured committee). Module singletons.
import { SealController, createDefaultRegistry, type PolicyRegistry } from '@meddleware/seal-client'
import { getSuiClient } from './wallet.js'
import { NETWORK, SEAL_PACKAGE_ID, SEAL_THRESHOLD, SEAL_SERVERS } from './config.js'

/** The policy registry (nft-gate + time-lock as peers). Iterate `list()` to render the picker. */
export const registry: PolicyRegistry = createDefaultRegistry()

let controller: SealController | null = null

/** Lazily build the SealController from build-time config + the shared registry. */
export function getSealController(): SealController {
  if (!controller) {
    controller = new SealController(
      {
        suiClient: getSuiClient(NETWORK),
        packageId: SEAL_PACKAGE_ID,
        threshold: SEAL_THRESHOLD,
        serverConfigs: SEAL_SERVERS,
      },
      registry,
    )
  }
  return controller
}
