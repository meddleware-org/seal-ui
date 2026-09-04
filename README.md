# @meddleware/seal-ui

Sealed Storage — a standalone Vue 3 SPA for client-side [Seal](https://seal-docs.wal.app/) encryption
with access-gated, decentralised [Walrus](https://walrus.xyz) storage on Sui.

Encrypt a file under a policy (access-gate NFT ownership, time-lock, …), store the ciphertext on
Walrus, and share a small **manifest**. Anyone with the manifest can decrypt — but only if the
on-chain policy allows (e.g. they hold a valid gate pass, or the unlock time has passed).

## How it works

1. **Encrypt** in the browser via `@meddleware/seal-client` (threshold Seal). No key material ever
   touches a server.
2. **Store** the opaque ciphertext on Walrus over HTTP; keep the returned blob id in the manifest.
3. **Decrypt** by signing one wallet message (mints a short-lived Seal SessionKey); a threshold
   committee of independent key servers releases key shares only if the on-chain `seal_approve`
   passes.

The policies live in the [`seal_policies`](https://github.com/meddleware-org/seal-policies-sui) Move
package; the client seam is [`@meddleware/seal-client`](https://github.com/meddleware-org/seal-client).

## Configure (build-time `VITE_*`)

| Var | Meaning |
| --- | --- |
| `VITE_NETWORK` | `testnet` (default) or `mainnet` (pending) |
| `VITE_SEAL_PACKAGE_ID_{NET}` | Published `seal_policies` package id |
| `VITE_SEAL_SERVER_OBJECT_IDS_{NET}` | CSV of key-server object ids (the committee) |
| `VITE_SEAL_AGGREGATOR_URLS_{NET}` | CSV of aggregator URLs (index-aligned) |
| `VITE_SEAL_THRESHOLD` | `t` in t-of-n (default 2) |
| `VITE_WALRUS_PUBLISHER_{NET}` / `VITE_WALRUS_AGGREGATOR_{NET}` | Walrus HTTP endpoints (defaults provided) |
| `VITE_RPC_{NET}` | Sui RPC URL override |

## Develop

```sh
# @meddleware/seal-client must be linked or published:
( cd ../seal-client && npm link )
npm install && npm link @meddleware/seal-client
npm run dev
```

## Build

```sh
npm run build           # vue-tsc + vite → dist/
docker build -t seal-ui .
```

Committee mode is testnet-only today; mainnet stays disabled with an in-app notice until it ships.

## License

BSD Zero Clause License (`0BSD`). See [LICENSE](LICENSE).
