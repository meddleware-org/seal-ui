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
#   VITE_SEAL_THRESHOLD                   — t in t-of-n (default 2)
#   VITE_WALRUS_PUBLISHER_{NET}           — Walrus HTTP publisher (optional; sensible default)
#   VITE_WALRUS_AGGREGATOR_{NET}          — Walrus HTTP aggregator (optional; sensible default)
#   VITE_WALRUS_EPOCHS                    — blob lifetime in epochs (default 5)
FROM node:22-slim AS build

WORKDIR /app

COPY package.json ./
RUN npm install
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
ARG VITE_SEAL_THRESHOLD
ARG VITE_WALRUS_PUBLISHER_TESTNET
ARG VITE_WALRUS_PUBLISHER_MAINNET
ARG VITE_WALRUS_AGGREGATOR_TESTNET
ARG VITE_WALRUS_AGGREGATOR_MAINNET
ARG VITE_WALRUS_EPOCHS

ENV VITE_NETWORK=${VITE_NETWORK} \
    VITE_RPC_TESTNET=${VITE_RPC_TESTNET} \
    VITE_RPC_MAINNET=${VITE_RPC_MAINNET} \
    VITE_SEAL_PACKAGE_ID_TESTNET=${VITE_SEAL_PACKAGE_ID_TESTNET} \
    VITE_SEAL_PACKAGE_ID_MAINNET=${VITE_SEAL_PACKAGE_ID_MAINNET} \
    VITE_SEAL_SERVER_OBJECT_IDS_TESTNET=${VITE_SEAL_SERVER_OBJECT_IDS_TESTNET} \
    VITE_SEAL_SERVER_OBJECT_IDS_MAINNET=${VITE_SEAL_SERVER_OBJECT_IDS_MAINNET} \
    VITE_SEAL_AGGREGATOR_URLS_TESTNET=${VITE_SEAL_AGGREGATOR_URLS_TESTNET} \
    VITE_SEAL_AGGREGATOR_URLS_MAINNET=${VITE_SEAL_AGGREGATOR_URLS_MAINNET} \
    VITE_SEAL_THRESHOLD=${VITE_SEAL_THRESHOLD} \
    VITE_WALRUS_PUBLISHER_TESTNET=${VITE_WALRUS_PUBLISHER_TESTNET} \
    VITE_WALRUS_PUBLISHER_MAINNET=${VITE_WALRUS_PUBLISHER_MAINNET} \
    VITE_WALRUS_AGGREGATOR_TESTNET=${VITE_WALRUS_AGGREGATOR_TESTNET} \
    VITE_WALRUS_AGGREGATOR_MAINNET=${VITE_WALRUS_AGGREGATOR_MAINNET} \
    VITE_WALRUS_EPOCHS=${VITE_WALRUS_EPOCHS}

RUN npm run build

# ── runtime stage ─────────────────────────────────────────────────────────────
FROM quay.io/meddleware-org/static-server:0.1.0

COPY --from=build /app/dist /app/public

ENV SERVE_DIR=/app/public \
    SPA_FALLBACK=true \
    CACHE_IMMUTABLE_PREFIX=/assets/

EXPOSE 8080
