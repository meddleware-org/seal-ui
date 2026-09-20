# Security Policy

## Scope

This policy covers security issues in the `@meddleware/seal-ui` application/library source
(`src/**`) — the encrypt/decrypt UI, the `SealView` library export, config/gating wiring, and the
Walrus HTTP storage helper.

It does not cover:

- `@meddleware/seal-client`, the Seal key-server committee, or `@mysten/seal`/`@mysten/sui` (see
  their own channels) — the committee holds all decryption keys and adjudicates `seal_approve`
- The Walrus HTTP publisher/aggregator endpoints or the wallet extension

## Security model (invariants)

These invariants are load-bearing. A report demonstrating that any is violated is in scope and
treated as high severity:

1. **The app never holds decryption keys.** Key material stays inside `@meddleware/seal-client` /
   the committee; decrypted plaintext is download-only and never logged or persisted.
2. **`SEAL_CONFIGURED` fails closed.** Sealing is disabled unless the package id and committee are
   both configured for the active network; a partially configured (e.g. mainnet-pending) state
   disables sealing rather than attempting it.
3. **No private key material is a `VITE_*` value.** Committee object ids and aggregator URLs are
   public config; no secret is inlined into the bundle.
4. **No dynamic HTML sinks.** Manifest fields (`label`/`params`/`policyType`) and policy-form inputs
   render as text; a downloaded manifest is parsed pollution-safe.

## Supported versions

Only the latest published version receives security fixes.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities. Report by emailing
**<security@meddleware.co.uk>** with a description, reproduction/PoC if available, and the version or
commit SHA tested. You will receive an acknowledgement within **3 business days** and a resolution
plan within **14 days** for confirmed issues; Critical issues (CVSS ≥ 9.0) are prioritised for
same-day acknowledgement.

## Disclosure

Once a fix is released, a security advisory will be published on the GitHub repository. Reporters may
be credited by name unless they prefer to remain anonymous.
