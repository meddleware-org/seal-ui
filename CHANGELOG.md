# Changelog

All notable changes to `@meddleware/seal-ui` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [Semantic Versioning](https://semver.org/).

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
