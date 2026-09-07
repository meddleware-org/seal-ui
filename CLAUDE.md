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
  (`src/walrus.ts`) — no `@mysten/walrus` SDK, no wasm. Routing uploads through the Meddleware relay
  (to capture tip/commission) is a documented future enhancement.
- **Wallet-agnostic + shared.** Wallet access goes through `src/wallet.ts`, a thin shim over the
  shared `@meddleware/wallet-adapter` singleton (binds this app's `RPC_URLS`). The wallet is needed
  only to decrypt (sign the SessionKey personal message) and to publish a discovery pointer. The
  singleton means that when `SealView` is embedded in the dashboard alongside other tool views,
  they all share one connection. Do not reintroduce a local wallet-standard implementation.

## Key files

| File | Purpose |
| --- | --- |
| `src/config.ts` | Build-time env: network, RPC, seal package id, committee ids/aggregators, walrus endpoints |
| `src/seal.ts` | Shared `registry` + lazy `SealController` from config |
| `src/wallet.ts` | Shim over `@meddleware/wallet-adapter` binding this app's `RPC_URLS`; re-exports `useWallet` / `getSuiClient` / `signPersonalMessage` / `signAndExecute` |
| `src/walrus.ts` | Walrus HTTP `storeBlob` / `readBlob` |
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

Seal committee mode is testnet-only today. On mainnet (`VITE_NETWORK=mainnet`) the app shows a
"mainnet pending" notice and disables sealing (`MAINNET_PENDING` / `SEAL_CONFIGURED` in config).

## Dependency order

`@meddleware/seal-client` must be published before the Docker image (or a plain `npm install`) can
build. For local dev: `cd ../seal-client && npm link`, then `npm link @meddleware/seal-client` here
(or set the dependency to `file:../seal-client` temporarily).

## What NOT to do

- Do not add policy-specific logic here — it belongs in `@meddleware/seal-client` + `seal_policies`.
- Do not hold or derive decryption keys; the committee does that.
- Do not hardcode network config; read `import.meta.env.VITE_*` via `src/config.ts`.
