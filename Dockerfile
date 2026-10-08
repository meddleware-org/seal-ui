# ── build stage ───────────────────────────────────────────────────────────────
# Standalone build — the Docker context is this repo root. @meddleware/* dependencies resolve
# from npm, so @meddleware/seal-client must be published before this image is built.
#
# VITE_* build args (baked into the static bundle at build time):
#   VITE_NETWORK                          — "testnet" | "mainnet" (default testnet)
#   (the seal_policies and access_gate ids come from the published `deployments`, not build args)
#   VITE_SEAL_SERVER_OBJECT_IDS_{NET}     — CSV of key-server object ids (committee)
#   VITE_SEAL_AGGREGATOR_URLS_{NET}       — CSV of aggregator URLs, index-aligned with the ids
#   VITE_SEAL_THRESHOLD_{NET}             — t over the configured servers (default 2 on testnet and mainnet)
#   VITE_SEAL_KEY_CUSTODY_{NET}           — "independent" (default) or "operator" (own key server: shows a notice)
#   (no API key: one in a VITE_* var would ship in the public bundle)
#   VITE_WALRUS_PUBLISHER_{NET}           — Walrus HTTP publisher (testnet default; mainnet has none)
#   VITE_WALRUS_AGGREGATOR_{NET}          — Walrus HTTP aggregator (optional; Mysten reference default)
#   VITE_WALRUS_EPOCHS                    — blob lifetime in epochs (default 5)
#   VITE_WALRUS_MAX_UPLOAD_BYTES          — largest ciphertext sent to the publisher (default 10 MiB)
#   VITE_INDEXER_URL                      — read-indexer for discovery (optional; falls back to the full node)
# Content-Security-Policy served by static-server (verified 2026-09-30: production build loaded in
# Chromium under this policy with zero violations). script-src stays 'self'; connect-src allows
# any https origin because RPC, relay, aggregator and Seal key-server hosts are partly operator- or
# chain-configured; img-src allows https:/data:/blob: for on-chain images and local previews.
ARG CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'; upgrade-insecure-requests"

FROM node:25-slim@sha256:81db02c4b671288a03915da9534dbd54f96d0e7c24d80ccc54f5b36b2e684370 AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci
COPY . .

ARG VITE_NETWORK=testnet
ARG VITE_SEAL_SERVER_OBJECT_IDS_TESTNET
ARG VITE_SEAL_SERVER_OBJECT_IDS_MAINNET
ARG VITE_SEAL_AGGREGATOR_URLS_TESTNET
ARG VITE_SEAL_AGGREGATOR_URLS_MAINNET
ARG VITE_SEAL_THRESHOLD_TESTNET
ARG VITE_SEAL_THRESHOLD_MAINNET
ARG VITE_SEAL_KEY_CUSTODY_TESTNET
ARG VITE_SEAL_KEY_CUSTODY_MAINNET
ARG VITE_WALRUS_PUBLISHER_TESTNET
ARG VITE_WALRUS_PUBLISHER_MAINNET
ARG VITE_WALRUS_AGGREGATOR_TESTNET
ARG VITE_WALRUS_AGGREGATOR_MAINNET
ARG VITE_WALRUS_EPOCHS
ARG VITE_WALRUS_MAX_UPLOAD_BYTES
ARG VITE_INDEXER_URL

ENV VITE_NETWORK=${VITE_NETWORK} \
    VITE_SEAL_SERVER_OBJECT_IDS_TESTNET=${VITE_SEAL_SERVER_OBJECT_IDS_TESTNET} \
    VITE_SEAL_SERVER_OBJECT_IDS_MAINNET=${VITE_SEAL_SERVER_OBJECT_IDS_MAINNET} \
    VITE_SEAL_AGGREGATOR_URLS_TESTNET=${VITE_SEAL_AGGREGATOR_URLS_TESTNET} \
    VITE_SEAL_AGGREGATOR_URLS_MAINNET=${VITE_SEAL_AGGREGATOR_URLS_MAINNET} \
    VITE_SEAL_THRESHOLD_TESTNET=${VITE_SEAL_THRESHOLD_TESTNET} \
    VITE_SEAL_THRESHOLD_MAINNET=${VITE_SEAL_THRESHOLD_MAINNET} \
    VITE_SEAL_KEY_CUSTODY_TESTNET=${VITE_SEAL_KEY_CUSTODY_TESTNET} \
    VITE_SEAL_KEY_CUSTODY_MAINNET=${VITE_SEAL_KEY_CUSTODY_MAINNET} \
    VITE_WALRUS_PUBLISHER_TESTNET=${VITE_WALRUS_PUBLISHER_TESTNET} \
    VITE_WALRUS_PUBLISHER_MAINNET=${VITE_WALRUS_PUBLISHER_MAINNET} \
    VITE_WALRUS_AGGREGATOR_TESTNET=${VITE_WALRUS_AGGREGATOR_TESTNET} \
    VITE_WALRUS_AGGREGATOR_MAINNET=${VITE_WALRUS_AGGREGATOR_MAINNET} \
    VITE_WALRUS_EPOCHS=${VITE_WALRUS_EPOCHS} \
    VITE_WALRUS_MAX_UPLOAD_BYTES=${VITE_WALRUS_MAX_UPLOAD_BYTES} \
    VITE_INDEXER_URL=${VITE_INDEXER_URL}

RUN npm run build

# ── runtime stage ─────────────────────────────────────────────────────────────
FROM quay.io/meddleware-org/static-server:0.1.6@sha256:be51c4ee9c80fbbeda1f546efa918a72628388bd0fac0f52876e8234b51275c0
ARG CSP
ENV CONTENT_SECURITY_POLICY="${CSP}"

COPY --from=build /app/dist /app/public

ENV SERVE_DIR=/app/public \
    SPA_FALLBACK=true \
    CACHE_IMMUTABLE_PREFIX=/assets/

EXPOSE 8080
