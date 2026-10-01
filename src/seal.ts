// Wires the shared @meddleware/seal-client into this app: a policy registry (drives the picker)
// and a SealController (encrypt/decrypt over the configured committee), each per network.
//
// SealController is loaded lazily (dynamic import) so @mysten/seal and @noble/curves are kept
// out of the initial bundle — they're only needed when the user triggers encrypt/decrypt.
import { computed } from 'vue'
import { createDefaultRegistry, type PolicyRegistry } from '@meddleware/seal-client'
import type { SealController } from '@meddleware/seal-client/controller'
import { getSuiClient } from './wallet.js'
import { activeConfig, type SealConfig } from './config.js'

const registries = new Map<string, PolicyRegistry>()
const controllers = new Map<string, SealController>()

/** The policy registry for a network (nft-gate + time-lock as peers). */
export function registryFor(cfg: SealConfig): PolicyRegistry {
  let r = registries.get(cfg.network)
  if (!r) {
    r = createDefaultRegistry(cfg.accessGateOriginalId)
    registries.set(cfg.network, r)
  }
  return r
}

/** The registry for the active network. Iterate `list()` to render the picker. */
export const registry = computed(() => registryFor(activeConfig.value))

/**
 * The SealController for the active network, built on first use.
 *
 * @throws {Error} when sealing is not configured on the active network (the reason is the message).
 */
export async function getSealController(): Promise<SealController> {
  const cfg = activeConfig.value
  if (cfg.problem || !cfg.seal) throw new Error(cfg.problem ?? `Sealed Storage is not available on ${cfg.network}.`)
  let c = controllers.get(cfg.network)
  if (!c) {
    const { SealController } = await import('@meddleware/seal-client/controller')
    c = new SealController(
      {
        suiClient: getSuiClient(),
        originalId: cfg.seal.originalId,
        publishedAt: cfg.seal.publishedAt,
        threshold: cfg.threshold,
        serverConfigs: cfg.servers,
      },
      registryFor(cfg),
    )
    controllers.set(cfg.network, c)
  }
  return c
}

/**
 * Drop every cached SessionKey (wallet disconnected or switched account). A no-op before a
 * controller has been loaded, so calling it never pulls `@mysten/seal` into the bundle.
 */
export function clearSealSessions(): void {
  for (const c of controllers.values()) c.clearSession()
}
