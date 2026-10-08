# Changelog

All notable changes to `@meddleware/seal-ui` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [Semantic Versioning](https://semver.org/).

## [0.0.32] - 2026-10-08

### Changed

- Operator-only discovery by default (opt-in for other publishers), refuse non-linked gates when sealing, publisher result handling; seal-client 0.0.16, access-gate-client 0.0.6, walrus-client 0.0.26

## [0.0.31] - 2026-10-03

### Changed

- seal-client 0.0.15, walrus-client 0.0.25, access-gate-client 0.0.4, ui 0.1.30, design-tokens 0.1.8.

## [0.0.30] - 2026-10-02

- **What you should know before sealing** (always shown): the key-server threshold, that the
  `seal_policies` package can still be upgraded until it is made immutable (changing access to sealed
  content), that released keys cannot be taken back, and that labels and gates are public.
- `@meddleware/seal-client` 0.0.14 (every policy verifies its identity layout; approve PTBs hold only
  `seal_approve*` calls) and `@meddleware/walrus-client` 0.0.24 (blob reads capped at 100 MiB).

## [0.0.29] - 2026-10-02

- `@meddleware/access-gate-client` 0.0.3 and `@meddleware/seal-client` 0.0.13: gate reads fail closed
  on a malformed object, and sealed-content discovery reads the indexer only over https.

## [0.0.28] - 2026-10-02

- `@meddleware/walrus-client` 0.0.22 (relay challenge requests time out).
- Ships the brand favicon (`/favicon.svg`); the old `/favicon.ico` link pointed at a missing file.

## [0.0.27] - 2026-10-02

- **Mainnet key servers** (workspace ADR-0002, D24): three keyless Open-mode servers run by
  independent operators — Overclock, NodeInfra, H2O Nodes — at threshold 2, replacing the planned
  Enoki committee. Mainnet sealing still waits for the mainnet `seal_policies` package.
- **No API key path.** `VITE_SEAL_AGGREGATOR_API_KEY_{NET}` is gone; a key in a `VITE_*` var would ship
  in the bundle. A test proves no server is ever configured with one.
- **Custody notice.** `VITE_SEAL_KEY_CUSTODY_{NET}` (`independent` by default, or `operator` for the
  self-hosted fallback) — with `operator`, the view says the site's operator could decrypt.
- **Re-seal** (Decrypt tab): decrypts content with the key servers it was sealed to and seals it again
  for the current ones, producing a new manifest (`@meddleware/seal-client` 0.0.12).
- The publish workflow passes the mainnet server ids, threshold and custody variables, so switching
  servers is a repository-variable change.

## [0.0.26] - 2026-10-02

- Targets the version-gated `seal_policies` (testnet `0x61c4aa…`) through `@meddleware/seal-client`
  0.0.11: the controller and the sealed-content publish pass the shared `PolicyConfig`.
  `@meddleware/access-gate-client` `^0.0.2` (version-gated `access_gate` `0xa55789…`).
- Testnet content sealed under the superseded `0x42cc18…` package (test data) no longer decrypts
  here: its ciphertexts name that package, which the controller refuses.

## [0.0.25] - 2026-10-01

- `@meddleware/walrus-client` range `>=0.0.21 <0.2.0` (was `^0.0.20`, an exact pin on 0.0.x), so a
  host such as the dashboard shares one copy.

## [0.0.24] - 2026-10-01

- Runs on static-server 0.1.3 (per-response CSP script nonce for Cloudflare JavaScript
  Detections, HSTS, Permissions-Policy).
- `@meddleware/seal-client` 0.0.10: calls target seal_policies v2 (`0x8fcf9c39…15cb`); identities
  still use the original id, so existing ciphertexts decrypt unchanged.

## [0.0.12] - 2026-09-17

### Added

- `VITE_DOCS_URL` build-time env var — configures the documentation link rendered in the app
  footer. Defaults to `https://docs.meddleware.co.uk/blockchain/sui/sealed-storage/`.
- `homepage` in `package.json` — links to the Sealed Storage docs section on npmjs.com.

## [0.1.0] - 2026-09-02

### Added

- Initial release. Sealed Storage SPA:
  - Encrypt a file under a registry-driven policy (nft-gate, time-lock), store the ciphertext on
    Walrus (HTTP publisher), and download a portable manifest.
  - Decrypt from a manifest: fetch ciphertext, mint a Seal SessionKey via one wallet signature, and
    download the plaintext.
  - Testnet-first with a mainnet-pending notice (Seal committee mode is testnet-only).
