import { parseSealedManifest, type PolicyRegistry, type SealedManifest } from '@meddleware/seal-client'

/**
 * Result of validating a pasted/loaded manifest: either the parsed manifest, or a human-readable
 * reason it was rejected. An empty input is `{ manifest: null, error: null }` (nothing to show yet).
 */
export type ManifestCheck =
  | { manifest: SealedManifest; error: null }
  | { manifest: null; error: string | null }

/**
 * Validate a manifest string for use on `network`. Rejects a malformed shape (via the shared
 * `parseSealedManifest` schema guard) and a manifest sealed for a different network — the latter
 * references a policy package + key-server committee that don't exist here and can never decrypt.
 * With the network's policy `registry`, the policy type must be registered and its params must parse,
 * so a bad manifest fails here instead of at transaction build time.
 */
export function checkManifestForNetwork(text: string, network: string, registry?: PolicyRegistry): ManifestCheck {
  if (!text.trim()) return { manifest: null, error: null }
  try {
    const manifest = parseSealedManifest(text)
    if (manifest.network !== network) {
      return {
        manifest: null,
        error: `This manifest is for '${manifest.network}', but this app is on '${network}'. It cannot be decrypted here.`,
      }
    }
    return { manifest: registry ? parseSealedManifest(manifest, registry) : manifest, error: null }
  } catch (e) {
    return { manifest: null, error: e instanceof Error ? e.message : 'Invalid manifest.' }
  }
}
