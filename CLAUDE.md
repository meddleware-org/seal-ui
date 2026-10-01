# CLAUDE.md — @meddleware/seal-ui

## What this app is

A standalone Vue 3 SPA for **Sealed Storage**: client-side Seal encryption + access-gated,
decentralised Walrus storage on Sui. Encrypt a file under a policy, store the ciphertext on Walrus,
and later decrypt it if the on-chain policy allows.

## Architectural invariants

- **Thin app, on-chain truth.** No policy logic here — all of it is in `@meddleware/seal-client`
  (the registry + `SealController`) and the `seal_policies` Move package. This app only wires config,
  wallet, and storage.
- **Registry-driven UI.** The policy picker and its form fields come from
  `registry.list()` + `provider.describe()`. Adding a policy type needs **no change here** — register
  a provider in `@meddleware/seal-client` and it appears automatically.
- **No server secrets, no key server.** Decryption keys come from a threshold committee of
  independent key servers (config-supplied). This app never holds key material.
- **Storage is opaque HTTP.** Ciphertext is stored/read via the Walrus HTTP publisher/aggregator
  (`src/walrus.ts`, a thin wrapper over `@meddleware/walrus-client/http`) — no `@mysten/walrus`
  SDK, no wasm. Routing uploads through the Meddleware relay
  (to capture tip/commission) is a documented future enhancement.
- **Wallet-agnostic + shared.** Wallet access goes through `src/wallet.ts`, a thin shim over the
  shared `@meddleware/wallet-adapter` singleton (client and executor for the selected network). The wallet is needed
  only to decrypt (sign the SessionKey personal message) and to publish a discovery pointer. The
  singleton means that when `SealView` is embedded in the dashboard alongside other tool views,
  they all share one connection. Do not reintroduce a local wallet-standard implementation.
  Declare `@meddleware/wallet-adapter` as a peerDependency (`>=0.0.12 <0.2.0`, plus a devDependency):
  the host's single copy must satisfy every embedded tool, or each gets its own connection.

## Key files

| File | Purpose |
| --- | --- |
| `src/config.ts` | `network` (wallet-adapter selector); `sealConfig(net)` / `activeConfig`: ids from `deployments`, committee + threshold + Walrus endpoints from `VITE_*_{NET}`, and `problem` when sealing is unavailable |
| `src/seal.ts` | Per-network `registry` + lazy `SealController` (`originalId` / `publishedAt` from `deployments`) |
| `src/sealed-content.ts` | `discoverSealedContent` over seal-client `listSealedContent` (optional indexer) |
| `src/wallet.ts` | Shim over `@meddleware/wallet-adapter` for the selected network; re-exports `useWallet` / `getSuiClient` / `signPersonalMessage` / `signAndExecute` |
| `src/walrus.ts` | `storeBlob` / `readBlob` over walrus-client `/http` with the network's endpoints |
| `src/components/SealView.vue` | Core tool UI (Encrypt/Decrypt/Unlock tabs, generic policy form, manifest, publish pointer). **Scoped** styles so it embeds without the global stylesheet. Exported from `src/index.ts`. |
| `src/index.ts` | Library entry — exports `SealView` for the dashboard to render inline |
| `src/App.vue` | Standalone shell only: `AppHeader` (+ network badge, `ColorModeControl`) + `<SealView>` + `AppFooter` |
| `src/styles.css` | Standalone-only globals (body/#app/h1); imported by `main.ts`. Component styles live scoped in `SealView.vue` — do NOT move them back here (a global import would restyle a host's body/#app/inputs). |

## Dual app + library

This package is **both** a standalone SPA (`App.vue` + `main.ts`, `vite build`) and a library
(`src/index.ts` exports `SealView`, resolved via `"exports"`). The dashboard imports `SealView` and
wraps it in its own shell + shared wallet. `SealView` carries its own **scoped** styles, so no
consumer needs seal-ui's `styles.css`. Keep the tool UI shell-free in `SealView.vue`; `App.vue` must
remain a thin shell.

## Network gating

The network is wallet-adapter's shared runtime selector (the standalone `main.ts` selects
`VITE_NETWORK`). Sealing is enabled while `activeConfig.problem` is null, which needs:

- a `seal_policies` deployment recorded for the network (in seal-client's `deployments`);
- a key-server committee (Mysten defaults on testnet and mainnet, or `VITE_SEAL_SERVER_OBJECT_IDS_{NET}`);
- a valid threshold.

Otherwise the view shows the reason and disables sealing. A network switch clears what was shown
for the previous network, and registries and controllers are kept per network.

Mainnet specifics (2026-09-29, workspace grounding log D4):

- The default committee is the verified Mysten mainnet committee behind the mainnet aggregator,
  at threshold 1 (a committee counts as one server). That aggregator needs
  `VITE_SEAL_AGGREGATOR_API_KEY_MAINNET` (an Enoki key).
- There is no default mainnet Walrus publisher; storing fails with a clear error until
  `VITE_WALRUS_PUBLISHER_MAINNET` names an operator-run publisher.
- A threshold outside `[1, total server weight]` disables sealing on that network with the reason.

## Storage and discovery safety

- Publisher uploads are `permanent=true`, use `send_object_to=<connected address>` (the user owns
  the `Blob` object), are capped at `VITE_WALRUS_MAX_UPLOAD_BYTES`, require https and time out.
- Reads use `strict_consistency_check=true`.
- Discovery is seal-client's `listSealedContent`: `SealedContentPublished` decoded from BCS at the
  deployment's original id, newest first with a page budget, gate ids compared normalised; from
  the read-indexer when `VITE_INDEXER_URL` is set (display data; falls back to the full node).
- The discovery pointer is built by seal-client (`buildPublishSealedContentTransaction`) at the
  latest `publishedAt`; this app constructs no transactions itself.
- Download filenames derived from on-chain labels are sanitised.
- Cached SessionKeys are dropped whenever the wallet disconnects or switches account.

## Dependency order

`@meddleware/seal-client` must be published before the Docker image (or a plain `npm install`) can
build. For local dev: `cd ../seal-client && npm link`, then `npm link @meddleware/seal-client` here
(or set the dependency to `file:../seal-client` temporarily).

## What NOT to do

- Do not add policy-specific logic here — it belongs in `@meddleware/seal-client` + `seal_policies`.
- Do not hold or derive decryption keys; the committee does that.
- Do not hardcode or env-configure package ids; they come from `deployments`. Operator settings
  are read per network via `sealConfig` in `src/config.ts`.

---

## Deferred documentation — NOT for the `docs.` website (planned here per Part 0.4)

> Captured for the future **`dev.meddleware.co.uk`** subdomain and white-label offering; excluded
> from the user-facing `docs.` site (which covers encrypt/store/decrypt for end users only).

### `dev.` — developer integration (to write later)

- **Embed `SealView`** (`import { SealView } from '@meddleware/seal-ui'`) with the shared
  `@meddleware/wallet-adapter`; the registry-driven policy picker means new policies need no change
  here. The SDK-level story (controller, providers, manifest) lives in `@meddleware/seal-client`; the
  on-chain policy contracts in `seal_policies` (`seal-policies-sui`).

### White-label operator path (to write later)

- Deploying against an operator's **own `seal_policies` package + key-server committee**: the
  `VITE_SEAL_*` build args (committee ids, aggregator URLs, threshold) and the published
  `deployments` the package ids come from; branding via design-tokens + `AppHeader`.
