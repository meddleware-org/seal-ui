# Changelog

All notable changes to `@meddleware/seal-ui` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [Semantic Versioning](https://semver.org/).

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
