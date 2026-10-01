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

The `seal_policies` and `access_gate` ids come from the published `deployments` (seal-client and
access-gate-client) for the active network; they are not configuration.

| Var | Meaning |
| --- | --- |
| `VITE_NETWORK` | Network the standalone build selects: `testnet` (default) or `mainnet`. Embedded, the host's selector rules. |
| `VITE_SEAL_SERVER_OBJECT_IDS_{NET}` | CSV of key-server object ids (the committee) |
| `VITE_SEAL_AGGREGATOR_URLS_{NET}` | CSV of aggregator URLs (index-aligned) |
| `VITE_SEAL_AGGREGATOR_API_KEY_{NET}` | Enoki API key sent as `X-API-Key` to aggregator-backed servers (required by the mainnet aggregator; publishable, baked into the bundle) |
| `VITE_SEAL_THRESHOLD_{NET}` | `t` over the configured servers; a committee behind an aggregator counts as one (default testnet 2, mainnet 1). An out-of-range value disables sealing on that network with an explanation |
| `VITE_WALRUS_PUBLISHER_{NET}` | Walrus HTTP publisher. Testnet has a default; **mainnet has none** (Walrus runs no public mainnet publisher), so set an operator-run publisher |
| `VITE_WALRUS_AGGREGATOR_{NET}` | Walrus HTTP aggregator (Mysten reference endpoints by default) |
| `VITE_WALRUS_MAX_UPLOAD_BYTES` | Largest ciphertext sent to the publisher (default 10 MiB, the public-publisher limit) |
| `VITE_INDEXER_URL` | Optional read-indexer for sealed-content discovery (display data; falls back to the full node) |

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
