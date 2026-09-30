# ── build stage ───────────────────────────────────────────────────────────────
# Standalone build — the Docker context is this repo root. @meddleware/* dependencies resolve
# from npm, so @meddleware/seal-client must be published before this image is built.
#
# VITE_* build args (baked into the static bundle at build time):
#   VITE_NETWORK                          — "testnet" | "mainnet" (default testnet)
#   VITE_RPC_{TESTNET,MAINNET}            — override default Sui RPC URLs (optional)
#   VITE_SEAL_PACKAGE_ID_{NET}            — published seal_policies package id (required to seal)
#   VITE_SEAL_SERVER_OBJECT_IDS_{NET}     — CSV of key-server object ids (committee)
#   VITE_SEAL_AGGREGATOR_URLS_{NET}       — CSV of aggregator URLs, index-aligned with the ids
#   VITE_SEAL_AGGREGATOR_API_KEY_{NET}    — Enoki API key for aggregator-backed servers (mainnet needs it)
#   VITE_SEAL_THRESHOLD                   — t over the configured servers (default testnet 2, mainnet 1)
#   VITE_WALRUS_PUBLISHER_{NET}           — Walrus HTTP publisher (testnet default; mainnet has none)
#   VITE_WALRUS_AGGREGATOR_{NET}          — Walrus HTTP aggregator (optional; Mysten reference default)
#   VITE_WALRUS_EPOCHS                    — blob lifetime in epochs (default 5)
#   VITE_WALRUS_MAX_UPLOAD_BYTES          — largest ciphertext sent to the publisher (default 10 MiB)
# Content-Security-Policy served by static-server (verified 2026-09-30: production build loaded in
# Chromium under this policy with zero violations). script-src stays 'self'; connect-src allows
# any https origin because RPC, relay, aggregator and Seal key-server hosts are partly operator- or
# chain-configured; img-src allows https:/data:/blob: for on-chain images and local previews.
ARG CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'; upgrade-insecure-requests"

FROM node:24-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6 AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci
COPY . .

ARG VITE_NETWORK=testnet
ARG VITE_RPC_TESTNET
ARG VITE_RPC_MAINNET
ARG VITE_SEAL_PACKAGE_ID_TESTNET
ARG VITE_SEAL_PACKAGE_ID_MAINNET
ARG VITE_SEAL_SERVER_OBJECT_IDS_TESTNET
ARG VITE_SEAL_SERVER_OBJECT_IDS_MAINNET
ARG VITE_SEAL_AGGREGATOR_URLS_TESTNET
ARG VITE_SEAL_AGGREGATOR_URLS_MAINNET
ARG VITE_SEAL_AGGREGATOR_API_KEY_TESTNET
ARG VITE_SEAL_AGGREGATOR_API_KEY_MAINNET
ARG VITE_SEAL_THRESHOLD
ARG VITE_WALRUS_PUBLISHER_TESTNET
ARG VITE_WALRUS_PUBLISHER_MAINNET
ARG VITE_WALRUS_AGGREGATOR_TESTNET
ARG VITE_WALRUS_AGGREGATOR_MAINNET
ARG VITE_WALRUS_EPOCHS
ARG VITE_WALRUS_MAX_UPLOAD_BYTES

ENV VITE_NETWORK=${VITE_NETWORK} \
    VITE_RPC_TESTNET=${VITE_RPC_TESTNET} \
    VITE_RPC_MAINNET=${VITE_RPC_MAINNET} \
    VITE_SEAL_PACKAGE_ID_TESTNET=${VITE_SEAL_PACKAGE_ID_TESTNET} \
    VITE_SEAL_PACKAGE_ID_MAINNET=${VITE_SEAL_PACKAGE_ID_MAINNET} \
    VITE_SEAL_SERVER_OBJECT_IDS_TESTNET=${VITE_SEAL_SERVER_OBJECT_IDS_TESTNET} \
    VITE_SEAL_SERVER_OBJECT_IDS_MAINNET=${VITE_SEAL_SERVER_OBJECT_IDS_MAINNET} \
    VITE_SEAL_AGGREGATOR_URLS_TESTNET=${VITE_SEAL_AGGREGATOR_URLS_TESTNET} \
    VITE_SEAL_AGGREGATOR_URLS_MAINNET=${VITE_SEAL_AGGREGATOR_URLS_MAINNET} \
    VITE_SEAL_AGGREGATOR_API_KEY_TESTNET=${VITE_SEAL_AGGREGATOR_API_KEY_TESTNET} \
    VITE_SEAL_AGGREGATOR_API_KEY_MAINNET=${VITE_SEAL_AGGREGATOR_API_KEY_MAINNET} \
    VITE_SEAL_THRESHOLD=${VITE_SEAL_THRESHOLD} \
    VITE_WALRUS_PUBLISHER_TESTNET=${VITE_WALRUS_PUBLISHER_TESTNET} \
    VITE_WALRUS_PUBLISHER_MAINNET=${VITE_WALRUS_PUBLISHER_MAINNET} \
    VITE_WALRUS_AGGREGATOR_TESTNET=${VITE_WALRUS_AGGREGATOR_TESTNET} \
    VITE_WALRUS_AGGREGATOR_MAINNET=${VITE_WALRUS_AGGREGATOR_MAINNET} \
    VITE_WALRUS_EPOCHS=${VITE_WALRUS_EPOCHS} \
    VITE_WALRUS_MAX_UPLOAD_BYTES=${VITE_WALRUS_MAX_UPLOAD_BYTES}

RUN npm run build

# ── runtime stage ─────────────────────────────────────────────────────────────
FROM quay.io/meddleware-org/static-server:0.1.2@sha256:87fb66d451e5846ea3af24266cc82546fa465afab5494d00261eeda6a70195b1
ARG CSP
ENV CONTENT_SECURITY_POLICY="${CSP}"

COPY --from=build /app/dist /app/public

ENV SERVE_DIR=/app/public \
    SPA_FALLBACK=true \
    CACHE_IMMUTABLE_PREFIX=/assets/

EXPOSE 8080
