# Security Audit — `seal-ui`

**Classification:** Internal security review
**Project:** `repos/seal-ui` — `@meddleware/seal-ui`, Vue 3 SPA and library for sealing content to Sui policies with Seal and storing it on Walrus (`sui-seal.meddleware.co.uk`; embedded in the dashboard)
**Project type:** Vue app + UI library
**Template:** AUDIT_TEMPLATE.md (2026-10-08) + AUDIT_TEMPLATE_VUE.md (2026-10-08) + AUDIT_TEMPLATE_TS.md (2026-10-08) + AUDIT_TEMPLATE_SUI_CLIENT.md (2026-10-08) + AUDIT_TEMPLATE_SEAL.md (2026-09-30) + AUDIT_TEMPLATE_WALRUS.md (2026-09-30) + AUDIT_TEMPLATE_IMG.md (2026-10-08)
Not triggered: AUTH (no credential is held or issued; the SessionKey is seal-client's, in memory, and no API key exists), OPS (no script signs on a real chain), PROXY, WORKERS, GO, RUST, SITE, PLATFORM (the cluster is audited with the workspace).
**Seal SDK:** `@mysten/seal` 1.4.19 (peer of `@meddleware/seal-client` 0.0.19, `^1.4.18`; one copy)
**Key-server mode:** testnet: Mysten committee via its aggregator + two Mysten Open-mode servers (the aggregator counts as one server); mainnet: three keyless Open-mode independent servers (ADR-0002, D24)
**Key servers per network:** testnet `0xb012378c…1e98` (committee, aggregator `seal-aggregator-testnet.mystenlabs.com`), `0x73d05d62…db75`, `0xf5d14a81…23c8` (Mysten Open); mainnet `0x145540d9…08b6` (Overclock), `0x1afb3a57…5475` (NodeInfra), `0x4a65b4ff…286a` (H2O Nodes); overridable per network by build variables, never with an API key
**Threshold:** 2 on both networks (weights counted; validated by `thresholdError`)   **verifyKeyServers:** seal-client switches it off as soon as any server uses an aggregator, so off on testnet and on for the mainnet set   **checkShareConsistency:** on (seal-client default)
**Key custody notice:** `VITE_SEAL_KEY_CUSTODY_{NET}` (`independent` | `operator`); operator mode shows a warning; any other value disables sealing
**Policy package:** testnet `seal_policies` `0x0c8f7349…773d` (original = published-at; republished 2026-10-09, links `access_gate` `0xd7ddaa94…`), `PolicyConfig` `0xee0403ba…7d1a`, from seal-client 0.0.19 `deployments`; UpgradeCap with the deploy key until the multisig transfer and burn in CUSTODY.md (`OPERATOR_TASKS.md` "Mainnet release custody"); the superseded `0x61c4aa…` (and older) are immutable, and content sealed under them no longer decrypts (decision: legacy namespaces unsupported); mainnet: not published, sealing shows "unavailable"
**Walrus SDK:** none; ciphertext goes through the HTTP publisher and aggregator (`@meddleware/walrus-client/http` 0.0.27); no wasm
**Package config source:** `deployments` of seal-client and access-gate-client (never env)
**Upload relays:** none (the Meddleware relay is a documented future option)
**Aggregator / publisher hosts:** testnet publisher `publisher.walrus-testnet.walrus.space`, aggregator `aggregator.walrus-testnet.walrus.space`; mainnet aggregator `aggregator.walrus-mainnet.walrus.space`, publisher none (Walrus runs no public mainnet publisher; storing fails with a clear message)
**Tip ceiling:** n/a (publisher pays)   **Epoch default / maximum:** 5 (`VITE_WALRUS_EPOCHS`) / 53, not shown to the user (F12)
**Deletable default:** permanent (`permanent=true` in the walrus-client call); the `Blob` object is sent to the user's address (`send_object_to`), who controls its lifetime
**Sui SDK:** `@mysten/sui ^2.33.2` (installed 2.35.0, one copy; `npm ls` single version)   **Transport:** gRPC through wallet-adapter
**Networks:** testnet (live); mainnet shows "unavailable" until `seal_policies` is published there; localnet likewise
**On-chain packages consumed:** `seal_policies` (above) and the `access_gate` original id `0xd7ddaa94…88c9` through access-gate-client 0.0.8 `deployments` (gate suggestions, linked-gate check); call targets `publishedAt`, identities and events `originalId`; never configuration
**Package manager / lockfile:** npm 11, committed (also copied into the image for SBOM tools)   **Module format / publish model:** ESM; ships source (library) + SPA image
**Runtime targets:** browser   **Peer dependencies:** `@meddleware/wallet-adapter >=0.0.12 <0.2.0`
**Build tool:** vite 8.3, `@vitejs/plugin-vue` 6.0.9, vue 3.5.43, vue-tsc 3.3.12, TypeScript 6.0.3, vitest 5.0.3
**Hosting:** container image on static-server (CSP and HSTS from the server); no static-host `_headers` file
**Embedding hosts:** the dashboard (`SealView`, scoped styles, no shell chrome)
**VITE_\* inventory:** `VITE_NETWORK` (testnet|mainnet, baked, selects the network only), `VITE_SEAL_SERVER_OBJECT_IDS_{NET}` / `VITE_SEAL_AGGREGATOR_URLS_{NET}` / `VITE_SEAL_THRESHOLD_{NET}` / `VITE_SEAL_KEY_CUSTODY_{NET}` (committee, per network), `VITE_WALRUS_PUBLISHER_{NET}` / `VITE_WALRUS_AGGREGATOR_{NET}` (storage hosts), `VITE_WALRUS_EPOCHS`, `VITE_WALRUS_MAX_UPLOAD_BYTES` (limits), `VITE_INDEXER_URL` (discovery read), `VITE_DOCS_URL` / `VITE_DEV_URL` (footer links); all public, none secret, none selects an on-chain package id; `.env.example` lists them all
**Images:** `quay.io/meddleware-org/seal-ui:0.0.37@sha256:7e919894…1b86` (Docker Hub mirror; cosign keyless, SPDX SBOM attestation, build provenance; verified 2026-10-09, `verify-digests.sh` 16/16)
**Base images:** build `node:24-slim@sha256:0e0ff40c…f9b6`; runtime `quay.io/meddleware-org/static-server:0.1.7@sha256:2e227311…2379` (Go 1.26.9)
**Runtime user:** `USER 65534:65534`   **Runtime FS:** read-only root, no writable mounts
**Deployed by:** `post-bootstrap/seal-ui/overlays/default`; digest from `config/images.yaml`
**Build args:** `CSP`, `VITE_NETWORK` and the `VITE_SEAL_*`, `VITE_WALRUS_*`, `VITE_INDEXER_URL` variables above — none secret, none a test switch (F15: two are passed from repository secrets)
**Deployment status:** npm v0.0.37 (2026-10-09); image `quay.io/meddleware-org/seal-ui` serving `sui-seal.meddleware.co.uk` at 0.0.37 (`sha256:7e919894…`, deployed 2026-10-09; the live bundle carries `seal_policies` `0x0c8f7349…`, `PolicyConfig` `0xee0403ba…`, `access_gate` `0xd7ddaa94…` and no superseded id); embedded in dashboard 0.1.84
**Review date:** 2026-09-18 (first pass) · re-verified 2026-10-02 · re-verified 2026-10-09
**Reviewer:** Internal review
**Severity ceiling:** Medium — confidentiality comes from Seal and the on-chain policy; the app chooses the policy, identity and storage and presents what users are sealing to, so a defect can mislead or deny, not disclose on its own.
**Status:** re-verified 2026-10-09

---

## Executive summary

The UI over seal-client and walrus-client: pick a policy (nft-gate, time lock), encrypt in the
browser, store the ciphertext on Walrus through a publisher, publish a discovery pointer, and later
discover, fetch and decrypt. Mainnet key servers are three independent Open-mode operators at
threshold 2 (D24); re-sealing onto a new server set is built in (`describeCiphertext`). The app holds
no keys and no on-chain logic of its own (the `suiBoundary` lint is clean), has no `v-html` and no
browser storage, and keeps SessionKeys in memory (seal-client).

First-pass findings are resolved or adjudicated. Earlier passes found:

- **F6 (Low, RESOLVED 0.0.30)** — SEAL-M8 requires telling users that the policy package's
  UpgradeCap holder can change access to content already sealed; the app did not. A **What you should
  know before sealing** panel now states it, with the threshold, permanent key release and public
  labels.

Re-verified 2026-10-09 (0.0.37; 37 unit tests, type-check and all three linters green, audit gate
1 allowlisted / 0 open; live site `sui-seal.meddleware.co.uk` and its bundle read the same day):

- **F7 (Low, RESOLVED 0.0.32–0.0.33)** — seal gives confidentiality, not authenticity. Discovery now
  lists only the gate operator's pointers (others opt-in and labelled unverified), sealing refuses a
  gate of another `access_gate` package (and, in seal-client 0.0.18, a transferable-pass gate), and a
  pasted manifest is checked against the network's policy registry.
- **F8 (Low, RESOLVED 0.0.34–0.0.37)** — the image release now runs the full CI workflow, scans the
  published image before cosign signs it, ships the lockfile for SBOM tools, serves
  `/THIRD_PARTY_LICENSES` (HTTP 200 live), runs as an explicit `USER 65534:65534` on static-server 0.1.7,
  and the pod sets `automountServiceAccountToken: false`.
- The known CI gap found in the sibling web apps **is present here**: **F9 (Low, DEFERRED)**
  `node-ci.yml` never runs the unit tests, and since 0.0.37 (`1c9a03e`) the image release `verify` job
  calls it instead of its own `npm test` step, so only the npm job still runs them.
- The newly applicable lens checks found further defects that are **not yet fixed** (code changes are
  outside this alignment; each is a small change for the next patch release): **F10 (Low, DEFERRED)** the
  primary buttons draw white text on `--accent`, 2.4–3.0:1 in the dark theme (the standalone default);
  **F11 (Low, DEFERRED)** an encrypt, re-seal or discovery that is still running when the network or
  account changes finishes against the new state; **F12 (Low, DEFERRED)** the ciphertext is stored for 5
  epochs and the user is never told when it expires; **F13 (Low, DEFERRED)** the Confirm step omits the
  policy parameters (the gate or unlock time) that decide who can decrypt; **F14 (Info, DEFERRED)** two
  TypeScript hygiene points; **F15 (Info, DEFERRED)** repository hygiene.
- design-tokens F10 (`color: var(--warning)` as text): not present here; the warning notice is a fixed
  `#d29922` tint behind `currentColor` text (not a text colour).
- Accepted or maintainer items: **F16** blanket `connect-src https:`, **F17** the npm job's gate is a
  subset of CI, **F18** the cosign identity pins the repository not the workflow (ACCEPTED-RISK), **F19**
  registry mirror and credential inventory (DEFERRED, maintainer).

Library fixes reach the app: every policy verifies its identity layout and approve PTBs hold only
`seal_approve*` calls (seal-client F10, F11); blob reads are capped and publisher responses are bounded
(walrus-client F10); discovery reads the indexer only over https (seal-client F12); the republished
`seal_policies` `0x0c8f7349…` linking the republished `access_gate` (seal-client 0.0.19). seal-client's live
testnet suite passed against the new packages on 2026-10-09; the end-to-end seal and decrypt in this UI is
not browser-tested here (C.2).

The severity ceiling stays Medium.

## Threat model / trust boundaries

**Trust anchor:** t of the configured key servers, each dry-running `seal_approve` on-chain.

| Actor | Holds / proves | Can do | Bounded by |
| --- | --- | --- | --- |
| User | wallet, passes, content | seal, store, decrypt | wallet confirmation; policies on-chain |
| Key servers | master shares | release or withhold; t together can decrypt | threshold; independent operators (mainnet); notice for operator custody |
| Policy UpgradeCap holder | package upgrades | change access to existing content | disclosed (F6); CUSTODY.md transfer and burn plan |
| Walrus publisher / aggregator | bytes | store or serve wrong bytes; stop storing at expiry | AES-GCM (tampering fails); strict consistency read; read cap; bounded response; expiry not shown (F12) |
| Pointer / manifest supplier | labels, ids | mislabel; point at another identity; publish to any gate | operator-only listing by default (F7); manifest validation (F1); identity checks in seal-client |
| Indexer | pointer rows | list pointers | display only; https |
| Whoever controls the build environment | the key-server set, threshold, publisher and indexer URLs (public `VITE_*`) | seal to servers they choose | public values, no package id or API key can be configured (I1); custody notice (I2) |
| Link author (`?gate=`) | a preselected gate in the Encrypt form | steer a user to seal to a gate they control | the gate id is visible in the form; not repeated on the Confirm step (F13) |
| Embedding host (dashboard) | the page around `SealView`, the shared wallet | switch account or network under the view | session clearing (I6), network watcher; in-flight operations are not cancelled (F11) |
| Base-image publisher, registry, CI publish job | image layers, what is signed | ship altered bytes | digest pinning, Trivy before cosign, keyless signature, SBOM and provenance (F8) |

### On-chain dependency matrix

| Object / package | ID (original-id · published-at) | Sourced from | Used as | If stale, wrong or attacker-supplied | Fails open / closed |
| --- | --- | --- | --- | --- | --- |
| `seal_policies` package, testnet | `0x0c8f7349…773d` · same (fresh publication 2026-10-09) | seal-client 0.0.19 `deployments` | identity namespace (`originalId`); `seal_approve*` and `publish` target (`publishedAt`) | ciphertext bound to another namespace never decrypts; superseded packages are refused | closed: no deployment ⇒ sealing disabled with the reason |
| `PolicyConfig`, testnet | `0xee0403ba…7d1a` | same | argument of every approve and publish | a stale version gate rejects calls | closed |
| `access_gate` package, testnet | `0xd7ddaa94…88c9` | access-gate-client 0.0.8 `deployments` | gate type filter for suggestions and the linked-gate check | a gate of another package could be sealed to (never unlockable) | closed: `assertLinkedGate` refuses it (F7) |
| `SealedContent` events | defined at `seal_policies` `originalId` | seal-client | discovery | look-alike events | closed (exact type, BCS decode) |
| Key servers | object ids (build/config) | `config.ts` defaults or `VITE_SEAL_SERVER_OBJECT_IDS_{NET}` | committee | wrong servers ⇒ cannot decrypt, or a wrong custody claim | closed on threshold errors; custody notice (I2) |
| mainnet | none recorded | — | — | — | closed (notice, sealing disabled) |

## Severity scale

Critical / High / Medium / Low / Info / Positive.

## Scope

- **In scope (0.0.37):** `src/**` (`SealView.vue`, `seal.ts`, `walrus.ts`, `config.ts`, `manifest-guard.ts`,
  `sealed-content.ts`, `wallet.ts`, `App.vue`, `main.ts`, `styles.css`), `index.html`, `public/`,
  `Dockerfile`, `.dockerignore`, workflows, `.github/audit-gate.mjs`, `.github/dependabot.yml`,
  `scripts/third-party-licenses.mjs`, `SECURITY.md`; the manifests in `post-bootstrap/seal-ui/`
  (read-only).
- **Out of scope:** seal-client, walrus-client, access-gate-client (own audits); key servers.
- **Environment (2026-10-09):** `npm test` 37/37 (7 files, vitest 5.0.3); `vue-tsc`; stylelint, eslint
  (+ vuejs-a11y), html-validate; production build; audit gate (1 allowlisted advisory, 0 open);
  `npm pack --dry-run` (19 files, source and changelog only); live headers and bundle of
  `sui-seal.meddleware.co.uk`. seal-client's live testnet suite exercises the same encrypt/decrypt path
  against the new packages (PASS 2026-10-09).

## Findings

### F1 — Manifest schema and network validated before decrypt

**Severity:** Low   **Disposition:** RESOLVED — `checkManifestForNetwork`; tests in
`manifest-guard.test.ts` (the first pass cited `seal-view.gating.test.ts`, which tests the gating notices).
**Remediation / evidence (2026-10-09):** since 0.0.33 (`972cea7`) the check also takes the network's
policy registry (seal-client 0.0.19 `parseSealedManifest(text, registry)`): the identity must be
even-length hex, the policy type must be registered and its params must parse and are narrowed to the
known keys, so a bad manifest fails at import, not at transaction build time. Tested: cross-network
message, malformed JSON, missing fields, unregistered policy type, network mismatch reported before a
policy error.

### F2 — Ciphertext trusts the Walrus endpoint

**Severity:** Low   **Disposition:** ADJUDICATED — AES-256-GCM makes tampering fail decryption; the
aggregator read uses `strict_consistency_check`; availability depends on Walrus (SECURITY.md).
**Remediation / evidence (2026-10-09):** the HTTP helpers refuse a non-https endpoint and redirects, cap
the read at 100 MiB and the publisher response at 64 KiB, require a valid blob id, and `storeBlob` refuses
an `alreadyCertified` answer (the user would own no Blob object to extend). Tested (`walrus.test.ts`).
Residual: the write side is not read back, so a publisher that returns a blob id for other bytes shows up
only at the first decrypt; accepted for a testnet publisher, and the user can read the blob back through
the aggregator.

### F3 — Attacker-supplied `params` as an input placeholder

**Severity:** Info   **Disposition:** ACCEPTED-RISK — text only, never HTML. Re-verified 2026-10-09: the
placeholder is `String(manifest.params[name])` bound as an attribute value; the registry now narrows
`params` to known keys on import (F1).

### F4 — No `SECURITY.md`

**Severity:** Low   **Disposition:** RESOLVED. Re-read 2026-10-09: present; its invariants (no keys held,
sealing fails closed per network, no secret in `VITE_*`, custody disclosed, no HTML sinks) match the code
and this audit; supported versions: latest only.

### F5 — Verified-clean properties

**Severity:** Positive — no API key in any build (mainnet servers are keyless; a config test proves no
key header); `verifyKeyServers` on where no aggregator is used; mainnet sealing refuses until the
policy package exists; decrypted files download through a sanitised file name; SessionKeys cleared on
disconnect and account switch (`clearSession`); discovery decoded from BCS at the original id.
Re-verified 2026-10-09: `config.test.ts` (never an API key; mainnet three servers at threshold 2; a
threshold no committee can meet is reported), `safeFileName` (word characters, dots and dashes, 100
characters, no leading dot), the plaintext `Blob` is downloaded, never rendered, and `clearSealSessions` is
called on disconnect and on an account change (`SealView.vue`; the clearing itself is tested in
seal-client).

### F6 — Policy upgradeability not disclosed

**Severity:** Low   **Disposition:** RESOLVED (0.0.30, `f1b8c77`)
**Where:** `src/components/SealView.vue`
**Issue:** SEAL-M8 — users were not told that until the `seal_policies` UpgradeCap is burned, its
holder can change who may decrypt existing content (the testnet cap is live).
**Impact:** users could seal data believing access was fixed.
**Remediation / evidence:** an always-present `<details>` panel lists the threshold (from the active
config), the upgradeability, permanent release and public labels; seal-client's `SECURITY.md` carries
the same text (seal-client F13). Re-verified 2026-10-09: the panel is still present and its wording is
still true — the republished testnet package's UpgradeCap is with the deploy key; multisig transfer and
burn are the pre-mainnet `CUSTODY.md` process (`OPERATOR_TASKS.md` "Mainnet release custody").

### F7 — Seal gives confidentiality, not authenticity: pointers, gates and manifests

**Severity:** Low   **Disposition:** RESOLVED (0.0.32 `603e0ed`, 0.0.33 `972cea7`; seal-client 0.0.16–0.0.19)
**Where:** `src/sealed-content.ts`, `src/seal.ts` (`accessGateOriginalId`), `src/manifest-guard.ts`,
`src/walrus.ts`
**Issue:** anyone can seal content to a gate and publish a pointer for it, and a pass holder decrypts it
successfully; the Unlock tab listed every publisher's pointers. A gate of another `access_gate` package
could be sealed to and never unlocked, and a transferable pass acts as membership for whoever holds it
once frozen or shared.
**Impact:** misleading content under a trusted gate's name; content sealed to a dead or effectively public
gate.
**Remediation / evidence:** `discoverSealedContent` lists only `gateOperators(...)` pointers by default
(an unresolvable operator set fails closed) and `includeOthers` is an unticked option that labels each
item "Published by …: decrypting proves it was sealed to this gate, not who wrote it"; the controller is
built with `accessGateOriginalId`, so `encrypt` refuses a gate of another package and (seal-client 0.0.18,
no `allowTransferableGates`) a transferable one; manifests are checked against the registry (F1).
Tested: `sealed-content.test.ts` (operators only, fail closed, indexer, no deployment),
`seal-controller.test.ts` (ids and `PolicyConfig` passed), `manifest-guard.test.ts`.

### F8 — Image release gate, scan, notices and runtime user

**Severity:** Low   **Disposition:** RESOLVED (0.0.34 `de4467a`, 0.0.36 `0d2871b`, 0.0.37 `1c9a03e`)
**Where:** `.github/workflows/docker-publish.yml`, `Dockerfile`, `scripts/third-party-licenses.mjs`, `post-bootstrap/seal-ui/base/deployment.yaml`
**Issue:** the image release was gated by a subset of CI, the published image was not scanned before
signing, the lockfile was not in the image (the SBOM saw only the base), no third-party licence texts were
served with the bundled npm code, the runtime user was only inherited from the base, and the base carried
Go 1.26.7 stdlib advisories.
**Impact:** a tag could ship what CI would have refused; an SBOM that misses the bundled dependencies;
redistributed MIT/Apache code without its notices.
**Remediation / evidence:** `verify` calls `node-ci.yml` and the build jobs `need` it (it lacks the unit
tests, F9); the public job runs Trivy on the pushed digest (CRITICAL/HIGH, fixable only, `exit-code: 1`)
before `cosign sign`, then an SPDX SBOM attestation and build provenance for quay.io and Docker Hub, with
no `continue-on-error`; the Dockerfile runs `npm run licenses` and copies `package-lock.json` to
`/usr/share/doc/seal-ui/`; `/THIRD_PARTY_LICENSES` returns HTTP 200 on the live site and CI runs
`check:licenses`; the runtime base is static-server 0.1.7 (Go 1.26.9) with an explicit
`USER 65534:65534`; the pod sets `automountServiceAccountToken: false`, `runAsNonRoot` uid 65534,
read-only root, no privilege escalation, all capabilities dropped, `RuntimeDefault` seccomp, probes and
limits, and a default-deny NetworkPolicy with an ingress allowance; the digest is identical in
`config/images.yaml` and the overlay; all images cosign-verified 2026-10-09 (`verify-digests.sh`, 16/16).
Not run: a Trivy *config* scan of the Dockerfile and manifests (the image scan runs at release).

### F9 — Unit tests are not run by CI or by the release gate

**Severity:** Low   **Disposition:** DEFERRED (next patch release; add one step to `node-ci.yml`; Section D pre-testnet "every test project runs in CI")
**Where:** `.github/workflows/node-ci.yml` (no `npm test` step); `docker-publish.yml` `verify` calls it
**Issue:** CI runs the audit gate, type-check, the three linters, the build and the licence check, but not
the 37 unit tests. Until 0.0.36 the image release's own `verify` job ran `npm test`; 0.0.37 (`1c9a03e`)
replaced it with a call to `node-ci.yml` (F8) and so dropped the tests from the image gate; the comment in
`docker-publish.yml` ("type-check, lint, tests, build, licences") is wrong. Only the npm job's `verify`
still runs them. TS lens: every test project that exists runs in CI.
**Impact:** a regression in the config, gating, manifest, storage or discovery logic could merge and be
released as an image without any gate failing.
**Remediation / evidence:** add `- run: npm test` to `node-ci.yml` (walrus-ui and token-deployer-ui already
have it); verified by reading both workflows 2026-10-09 and running the suite locally (37/37 pass, so
adding the step turns nothing red).

### F10 — Primary buttons draw white text on the accent colour

**Severity:** Low   **Disposition:** DEFERRED (next patch release; one-line change; Section D pre-testnet "colour")
**Where:** `src/components/SealView.vue:788` (`button.primary { background: var(--accent, #c0503f); color: #fff }`)
**Issue:** in the dark theme `--accent` is a light stop (`#e07850`, or the season's 300/400 stop) and the
design-tokens role for text on it is `--accent-contrast` (`#201b19`). Hard-coded `#fff` gives 3.01:1 with
the default accent and 2.4–2.5:1 with the spring, summer, autumn and winter accents, against the 4.5:1 AA
text minimum (computed from design-tokens 0.1.9; light-theme combinations pass, 5.1–6.8:1). Every primary
action (Next, Encrypt & store, Decrypt, Publish, Find, Unlock) uses it, and the standalone app defaults to
the dark theme.
**Impact:** the main buttons are hard to read for low-vision users in the dark theme. The label is also
the button's accessible name, so nothing is hidden. Not browser-checked per theme and season: the
`@meddleware/ui` gallery axe gate covers the shared components only.
**Remediation / evidence:** use `color: var(--accent-contrast)`. `button.link` and `.muted` use `--accent`
and `--muted` as text and pass in both themes (4.7–8.4:1).

### F11 — In-flight operations finish against the new network or account

**Severity:** Low   **Disposition:** DEFERRED (next patch release; Section D pre-testnet "state invalidated on switch")
**Where:** `src/components/SealView.vue` (`performEncrypt`, `performReseal`, `performDiscover`; the
`watch(network)` and account watchers)
**Issue:** a network switch clears `manifest`, `discovered` and the status, but an operation that is
already awaiting is not cancelled and not bound to the state it started in. `performEncrypt` reads
`network.value` and `account.value?.address` after its awaits: the manifest is labelled with the network
at completion although the ciphertext was sealed by the previous network's controller and stored on its
publisher, and `sendObjectTo` is the account at completion. `performDiscover` and `performReseal` assign
their results the same way. VUE lens *Shared-wallet state*: results that arrive after a switch are
discarded.
**Impact:** a switch during a seal can produce a manifest that names the wrong network (the import check
then rejects it on the right one, F1) and a Blob object sent to another of the user's accounts. No key or
funds are at risk; the content is still decryptable only under its own namespace.
**Remediation / evidence:** capture `network`, `owner` and the config at the start, compare after each await
(or ignore the result when they differ), and disable the network control while `busy`. No test covers a
mid-flight switch.

### F12 — The ciphertext's storage lifetime is never shown

**Severity:** Low   **Disposition:** DEFERRED (next patch release; Section D pre-mainnet "lifetime shown and an extension path stated")
**Where:** `src/walrus.ts` (`WALRUS_EPOCHS`, default 5), `SealView.vue` (Confirm step, manifest)
**Issue:** `storeBlob` stores the ciphertext for `VITE_WALRUS_EPOCHS` epochs (5 by default) and returns
only the blob id; the publisher's `endEpoch` is discarded. Neither the Confirm step, the manifest nor the
trust panel says how long the content will exist, and nothing points to the way to extend it (the Blob
object belongs to the user, so walrus-ui's My Blobs can). The value is not validated (`Number(...)`);
a bad value makes the publisher refuse, so it fails closed. WALRUS lens *Epochs & lifetime*: expiry is
tracked and an extension flow exists.
**Impact:** sealed content silently becomes unrecoverable at expiry although the key servers still work and
the manifest still validates. Availability only; the testnet default is short.
**Remediation / evidence:** show the end epoch from `PublishResult.endEpoch` on the Confirm/result step and
in the manifest (or a note and a link to walrus-ui), and validate `VITE_WALRUS_EPOCHS` as an integer in
1..53.

### F13 — The Confirm step omits what decides who can decrypt

**Severity:** Low   **Disposition:** DEFERRED (next patch release; Section D pre-testnet "signing UX")
**Where:** `src/components/SealView.vue` (Encrypt step 2, `onMounted` deep link)
**Issue:** the Confirm step lists the policy label, the file and the label, not the policy parameters
(the gate id, or the unlock time). A link `?gate=<id>` preselects the nft-gate policy and the gate in step
1; the id is visible there, in a text field, but not on the step where the user presses **Encrypt & store**.
VUE lens *Signing UX* / SEAL *Metadata leakage*: show what is being sealed to.
**Impact:** a user following a crafted link could seal a file to a gate they do not control, whose
operator's pass holders can then decrypt it. Needs the user to overlook the field; seal-client refuses
gates of another package and transferable ones (F7), so the gate must be a soulbound gate of the real
package.
**Remediation / evidence:** list every encrypt parameter on the Confirm step (with the gate's operator
address from `gateOperators`), and say on the page when the gate came from a link.

### F14 — TypeScript hygiene: unguarded caller-keyed lookups and an unjustified cast

**Severity:** Info   **Disposition:** DEFERRED (next patch release; two lines)
**Where:** `src/config.ts` (`SEAL_POLICIES_DEPLOYMENTS[net]`, `ACCESS_GATE_DEPLOYMENTS[net]`,
`SERVER_DEFAULTS[net]`, `WALRUS_DEFAULTS[net]`), `src/sealed-content.ts` (`client as never`)
**Issue:** TS lens *Caller-keyed lookups*: these index records with a string through a cast, so a key such
as `constructor` resolves to a prototype member (seal-client's own `sealPoliciesDeployment` guards this with
`Object.hasOwn` since 0.0.16, but the app does not call it). `net` comes only from the closed wallet-adapter
selector, and a prototype key would yield no servers ("not configured"), so it fails closed and is not
reachable. The `as never` cast that passes the wallet-adapter client to `gateOperators` carries no
justification comment (TS lens *Assertions*).
**Impact:** none today; a future caller passing a user-supplied name would meet the pitfall.
**Remediation / evidence:** use `Object.hasOwn` (or call `sealPoliciesDeployment` / `accessGateDeployment`)
and add the reason for the cast or fix the client type.

### F15 — Repository and workflow hygiene

**Severity:** Info   **Disposition:** DEFERRED (next patch release)
**Where:** `.gitignore`, `package.json`, `.github/workflows/docker-publish.yml`
**Issue:** (a) `.gitignore` has no `.env` pattern, although `.env.example` says to copy it to `.env.local`
and never commit it (`.dockerignore` excludes `.env*.local`, so the image is safe); (b) the build passes
`VITE_SEAL_SERVER_OBJECT_IDS_TESTNET` and `VITE_SEAL_AGGREGATOR_URLS_TESTNET` from repository *secrets*,
although both are public values baked into the bundle: a keyed aggregator URL put there would ship in the
bundle (ADR-0002 forbids it; `config.ts` never adds a key, but the URL itself is not checked); (c)
`@mysten/wallet-standard` is a dependency that nothing in `src/` or `tests/` imports.
**Impact:** none on behaviour; (b) hides public values from build logs and invites a mistake.
**Remediation / evidence:** ignore `.env` and `.env.*` except `.env.example`; move the two values to
repository variables; drop the dependency.

### F16 — `connect-src` allows any https origin

**Severity:** Info   **Disposition:** ACCEPTED-RISK
**Where:** `Dockerfile` (`CSP` argument); live header read 2026-10-09
**Issue:** `connect-src 'self' https:` and `img-src 'self' data: blob: https:` are blanket allowances.
**Impact:** an injected script could send data to any https host. Script injection is the prerequisite,
and `script-src 'self' 'nonce-…'` with no inline script and no XSS sink is the control on that.
**Remediation / evidence:** accepted: the RPC node, key servers, aggregators, publishers and the indexer
are operator- or chain-configured per network, so the hosts cannot be enumerated in a white-label build.
No `'wasm-unsafe-eval'` is needed (no wasm). Revisit when the hosts are fixed for mainnet.

### F17 — The npm publish gate is a subset of CI

**Severity:** Low   **Disposition:** ACCEPTED-RISK
**Where:** `.github/workflows/npm-publish.yml`
**Issue:** the npm job's `verify` runs `npm ci`, the audit gate, type-check and the unit tests, not the
full CI workflow (linters, licence check). The image release (F8) does run the full workflow on the same
tag.
**Impact:** a tag could publish the source package while the image job refuses the same commit. The
package is source only (`npm pack --dry-run` 2026-10-09: `src`, `index.html`, `vite.config.ts`,
`tsconfig.json`, README, CHANGELOG, LICENSE; no tests, fixtures or `.env*`).
**Remediation / evidence:** accepted: a source mirror for the dashboard, OIDC-published with provenance,
tag == version checked, idempotent, and opt-in through the `NPM_PUBLISH` variable. Calling `node-ci.yml`
from `npm-publish.yml` would close it.

### F18 — The cosign identity pins the repository, not the workflow

**Severity:** Info   **Disposition:** ACCEPTED-RISK
**Where:** `bootstrap/images/verify-digests.sh` (workspace); this repository publishes no verify command
**Issue:** the cluster check accepts any workflow identity of `github.com/meddleware-org/seal-ui`.
**Impact:** a workflow added by someone with write access could sign an image the check would accept.
**Remediation / evidence:** the repository is the signing boundary; anchoring to
`docker-publish.yml@refs/tags/v*` is a `COSIGN_IDENTITY_REGEXP` override in the workspace script. The
deployed digest verified 2026-10-09 (16/16).

### F19 — Self-hosted registry mirror and registry credentials

**Severity:** Info   **Disposition:** DEFERRED (maintainer; `OPERATOR_TASKS.md` "Image registry credentials — record scope and rotation")
**Where:** `docker-publish.yml` private mirror jobs (`continue-on-error: true`); `QUAY_TOKEN`, `DOCKERHUB_TOKEN`
**Issue:** the mirror jobs fail without registry credentials and never sign; the quay.io and Docker Hub
tokens are long-lived and not yet inventoried.
**Impact:** the mirror may lag; a leaked token could push an unsigned tag (the cluster pins digests and
verifies signatures, so it would not run).
**Remediation / evidence:** the mirror is listed as best-effort; the public job has no `continue-on-error`.
The credential inventory (scope, holder, expiry, rotation) is the maintainer item.

## Section A — Invariant verification matrix

| # | Invariant | Enforced at | Proven by | Status |
| --- | --- | --- | --- | --- |
| I1 | Mainnet uses ≥ 2 independent keyless servers at t = 2, no API key; package ids only from `deployments` | `config.ts` defaults | `config.test.ts`; live bundle read 2026-10-09 (only `0x0c8f7349…`, `0xee0403ba…`, `0xd7ddaa94…`) | HOLDS |
| I2 | Operator custody is announced | `VITE_SEAL_KEY_CUSTODY_*` notice | `config.test.ts`, `seal-view.gating.test.ts` | HOLDS |
| I3 | Trust assumptions shown before sealing | `SealView.vue` | template | HOLDS (F6) |
| I4 | Sealing refuses on a network without a policy package | `config.ts` (`problem`) | `config.test.ts`, `seal-view.gating.test.ts` | HOLDS |
| I5 | Manifests validated for schema, network and policy | `checkManifestForNetwork` | `manifest-guard.test.ts` | HOLDS (F1) |
| I6 | Sessions cleared on disconnect / switch | `seal.ts` `clearSealSessions`, account watcher | — (code-only here; tested in seal-client) | HOLDS (code-only) |
| I7 | No on-chain logic in the app | seal-client, walrus-client, access-gate-client | `suiBoundary` lint (eslint-config 0.0.2, clean 2026-10-09) | HOLDS |
| I8 | Discovery lists the gate operator's pointers unless the user opts in | `sealed-content.ts` | `sealed-content.test.ts` | HOLDS (F7) |
| I9 | Sealing refuses a gate that cannot be unlocked or is effectively public | `accessGateOriginalId` in the controller config; seal-client 0.0.18 | `seal-controller.test.ts` (config passed); refusal tested in seal-client | HOLDS (F7) |
| I10 | The unit tests run on every change and every release | none (`node-ci.yml` has no test step) | none | GAP — see F9 |
| I11 | An in-flight operation never finishes against a different network or account | none | none | GAP — see F11 |
| I12 | What the content is sealed to, and for how long it is stored, is shown before storing | gate field in step 1; trust panel | source | GAP — see F12, F13 |

### Lens categories

| Lens | Category | Status |
| --- | --- | --- |
| SEAL | Encryption binding, namespacing, approve PTB, SessionKey | through seal-client (its audit): original id as namespace, `publishedAt` for approve targets, transaction-kind-only PTBs, SessionKey TTL 10 min cached per address and package, in memory only, cleared on disconnect and account switch; one wallet prompt per mint |
| SEAL | Threshold configuration | HOLDS (I1) — t ≤ servers validated by `thresholdError`; a committee counts as one server; mainnet three independent operators at t = 2; `verifyKeyServers` is off wherever an aggregator is used (testnet), `checkShareConsistency` on |
| SEAL | Ciphertext integrity | HOLDS — AES-256-GCM; tampering fails decryption (F2) |
| SEAL | Metadata leakage, policy semantics, upgradeability | HOLDS (I3) — labels, gate and identity inputs are public; non-revocability and the UpgradeCap are stated (F6); the manifest holds no secret |
| SEAL | Re-sealing | HOLDS — `resealCiphertext` decrypts under the old set and re-encrypts under the configured one; tested (`reseal.test.ts`) |
| SEAL | Discovery registries | HOLDS — paginated and filtered in seal-client (`MAX_DISCOVERED` 200 here), operator-only by default (F7), labels rendered as text |
| WALRUS | Storage path | publisher with `send_object_to` the user; reads strict, capped and bounded; the Blob is permanent |
| WALRUS | Epochs & lifetime | GAP — 5 epochs by default, never shown, no expiry tracking (F12) |
| WALRUS | Blob ownership, Confidentiality | HOLDS — the user owns the Blob object; the publisher sees only ciphertext |
| WALRUS | Payment bounds, Relay authentication, Relay selection, Flow resumability | N/A — no relay, no tip and no gated upload; the publisher pays |
| WALRUS | Size limits | client cap 10 MiB (`VITE_WALRUS_MAX_UPLOAD_BYTES`; public publishers cap at 10 MiB), UX only |
| VUE | Untrusted rendering | HOLDS — labels, publishers, blob ids and manifest fields as text; sanitised download names; the plaintext is downloaded, never rendered |
| VUE | Colour & links | GAP — white text on the accent in the dark theme (F10); no `--warning` text; no running-text links |
| VUE | Build-time configuration | HOLDS — no secrets in `VITE_*`; custody and server sets public; every variable in `.env.example`; ids from `deployments` (VUE-M2); two public values are passed from repository secrets (F15) |
| VUE | Test hooks | N/A — none; no test mode exists |
| VUE | Signing UX | HOLDS for the wallet prompts (the SessionKey message and the pointer transaction are shown by the wallet; buttons are disabled while busy); GAP for what is sealed to on the Confirm step (F13) |
| VUE | Shared-wallet state | HOLDS (I6) for sessions; GAP for in-flight operations (F11); the chain-id check and account-change events are wallet-adapter 0.0.17's (own audit) |
| VUE | Browser storage | N/A — none |
| VUE | Lazy boundaries | HOLDS — `SealController` and `@mysten/seal` load on first use |
| VUE | Dual app / library | HOLDS — `SealView` has scoped styles and no shell chrome |
| VUE | Estimates | N/A — the app computes no cost or fee |
| SUI_CLIENT | ABI mirroring, Funds in the PTB, Value encoding, Read parsing, Events, Signature verification, Dry-run, Client-side publish | N/A / through the libraries — the app calls `buildPublishSealedContentTransaction` (seal-client) and builds no `moveCall`; seal-client owns ABI tests and the weekly live suite |
| SUI_CLIENT | Package-ID split, Network / chain binding | HOLDS — `originalId` for identities and events, `publishedAt` for call targets; the selector selects ids, client and wallet chain together; empty ids disable sealing |
| SUI_CLIENT | Execution result | HOLDS — wallet-adapter's executor throws on a failed transaction; the pointer publish shows the digest only after success |
| SUI_CLIENT | Chain-access layering | HOLDS — `suiBoundary` forbids PTB and read logic outside `src/wallet.ts`; type-only SDK imports |
| TS | Compiler strictness | HOLDS — `strict: true`, `vue-tsc --noEmit` in CI |
| TS | Assertions, validation, money, promises, network I/O, encoding, dynamic code | HOLDS except F14 — no `eval`, no `fetch` in `src/` (the HTTP helpers are walrus-client's, with timeouts, https and redirect refusal); no money math; dynamic imports have literal specifiers; the catch blocks surface the message |
| TS | Caller-keyed lookups | GAP (Info) — F14 |
| TS | Packaging, supply chain | HOLDS — `files` whitelist (`npm pack --dry-run` clean); `npm ci`; audit gate; but the unit tests are not run in CI (F9) |
| IMG | Base images, build context, reproducible build, no secrets, runtime user, scan, SBOM and notices | HOLDS (F8) — digest-pinned `node:24-slim` and static-server 0.1.7; `.dockerignore` excludes `node_modules`, `dist`, `.git`, `.github`, `.env*.local`; `npm ci`; no secret in any `ARG`/`ENV`; Trivy before cosign; lockfile in the image; `/THIRD_PARTY_LICENSES` served |
| IMG | Verification command | GAP accepted — the identity pins the repository (F18) |
| IMG | Deployment pinning | HOLDS — digest in `config/images.yaml` and the overlay; the base manifest's tag label (`0.0.4`) is overridden by the overlay digest and is cosmetic |

## Section B — Supply-chain, publish-authority & capability matrix

### B.1 Dependency & CVE risk

| Dependency | Pinned version | Liveness dependency? | CVE / audit status | Notes |
| --- | --- | --- | --- | --- |
| `@meddleware/seal-client` | `^0.0.19` (installed 0.0.19) | seal / decrypt | `npm audit` gate clean 2026-10-09 | latest |
| `@meddleware/walrus-client` | `^0.0.27` | store / read | clean | latest |
| `@meddleware/access-gate-client` | `^0.0.8` | gate suggestions, linked-gate check | clean | latest |
| `@meddleware/wallet-adapter` | peer `>=0.0.12 <0.2.0`; dev `^0.0.17` | wallet | own audit | host's copy |
| `@meddleware/ui` / `design-tokens` / `eslint-config` | `^0.1.31` / `^0.1.9` / `^0.0.2` | UI | own audits | latest published |
| `@mysten/seal` | via seal-client peer (`^1.4.18`; installed 1.4.19) | crypto | clean | one copy |
| `@mysten/sui` | `^2.33.2` (installed 2.35.0) | reads, transactions (type imports only here) | gate clean | one copy (`npm ls`); ADR-0001 baseline `^2.33.1` |
| `@mysten/wallet-standard` | `^0.21.0` | none | clean | declared, imported nowhere in `src/` or `tests/` (F15) |
| Vue / Vite / TypeScript / vitest | 3.5.43 / 8.3 / 6.0.3 / 5.0.3 (plugin-vue 6.0.9, vue-tsc 3.3.12) | build | clean | TypeScript 7 and vitest 5-major follow-ups declined (decision); Node 24 LTS |
| Key servers | `config.ts` | decrypt | — | ADR-0002; fail closed |
| Walrus publisher / aggregator | per network | store / read | — | fail closed (no bytes) |
| `static-server` / `node:24-slim` | 0.1.7 / digest-pinned | runtime / build | Trivy at release (F8); Go 1.26.9 | — |
| dev tooling | lockfile | no | GHSA-vfj7-8cjw-p6xm allowlisted to 2027-01-01 | `.github/audit-allowlist.json` |

Shared-dependency matrix (TS lens): `@mysten/sui` dep `^2.33.2` (baseline `^2.33.1`, within range);
`@mysten/seal` not declared (the seal-client peer, `^1.4.18`); `@mysten/walrus`, `@mysten/walrus-wasm`,
`@mysten/bcs`: not used (walrus-client's peer `@mysten/walrus ~1.2.32` is installed under it but unused here);
`vue` dep `^3.5.43`; `typescript` dev `~6.0.0`; `vitest` dev `~5.0.2`; `@mysten/wallet-standard` dep
`^0.21.0`. First-party ranges are `^0.0.x` (exact) or `^0.1.x`; no `~0.0.x`; the peer range for
wallet-adapter is `>=0.0.12 <0.2.0`, no `legacy-peer-deps`.

Install-time code (TS B.TS-2): the lockfile has one lifecycle script, `fsevents` (dev, optional, macOS
only); no `allowScripts`, no `overrides`; no `prepare`/`postinstall` in `package.json`.

### B.2 Publish authority, capabilities & secret custody

| Authority / secret | Where held | Custody | Gates | Rotation |
| --- | --- | --- | --- | --- |
| npm publish | GitHub Actions | OIDC + provenance; opt-in `NPM_PUBLISH` | library | n/a |
| `QUAY_TOKEN`, `DOCKERHUB_TOKEN` | GitHub secrets | long-lived robot accounts (inventory: `OPERATOR_TASKS.md`) | image push | F19 |
| image signing | GitHub Actions | cosign keyless | images | n/a |

No API keys anywhere (D24). CI & release integrity: actions pinned by SHA (workflows read 2026-10-09);
explicit `permissions:` per workflow and job (`id-token`/`attestations` only on the signing job, `id-token`
only on the npm publish job); OIDC publish with a tag == version check; npm client pinned
(`npm@11.20.0`); image release = full CI via `workflow_call` + Trivy + cosign + SPDX SBOM attestation +
provenance, no `continue-on-error` on the public path (F8; the CI workflow lacks the tests, F9; the npm
gate is a subset, F17); `npm ci` everywhere; audit gate in CI and the npm job; Dependabot weekly and
grouped for npm, Docker and Actions; no test-only build mode exists, so there is nothing to scan for; no
job spends real funds.

### B.SEAL-1 Committee readiness

Testnet servers exercised by seal-client's live suite (PASS 2026-10-09 against the new packages); mainnet
server terms are an operator-register task (`OPERATOR_TASKS.md` "Mainnet Seal key servers — confirm terms
before launch"); mainnet sealing waits for the `seal_policies` publish. The server set and threshold are
build variables (a repository-variable change plus a release); content stays bound to the servers it was
sealed to and moves with the re-seal action. The self-hosted fallback (`seal-key-server`, not deployed) is
custodial and triggers the operator notice.

### B.SEAL-2 Discovery registries

Pointers are read through seal-client `listSealedContent` (cursor-paged, at most 200 listed, a row that
does not decode is skipped and counted), filtered to the gate operator's by default, rendered as text
(label, publisher, blob id), and the indexer is read over https only as display data.

### B.VUE-1 Hosting headers

Live headers on `sui-seal.meddleware.co.uk`, read 2026-10-09: `Content-Security-Policy`
(`default-src 'self'`, `script-src 'self' 'nonce-…'`, `style-src 'self' 'unsafe-inline'`,
`connect-src 'self' https:`, `img-src 'self' data: blob: https:`, `worker-src 'self' blob:`,
`object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'self'`,
`upgrade-insecure-requests`), `Strict-Transport-Security` (1 year, includeSubDomains),
`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
`Permissions-Policy`, `X-Frame-Options: SAMEORIGIN`. The CSP is static-server's
(`CONTENT_SECURITY_POLICY` from the `CSP` build argument); there is no static host and no `_headers`
file. `'unsafe-inline'` is for styles only; the build emits no inline script. The blanket `https:` is F16.
Framing is `'self'` only; the dashboard embeds the view as a component, not a frame.

### B.VUE-2 Build inputs and artifacts / IMG

`node:24-slim@sha256:0e0ff40c…` builder and `static-server:0.1.7@sha256:2e227311…` runtime, both
digest-pinned (Dependabot Docker group); `npm ci`; `.dockerignore` excludes local installs, build output,
VCS data and every `.env*.local`; `npm run build && npm run licenses` run in the build stage; the runtime
stage copies `dist` and the lockfile only; `USER 65534:65534`; no secret in any `ARG`/`ENV` (the build
args are public configuration and the CSP); production sourcemaps are not emitted (Vite default); the
deployment is read-only root, `runAsNonRoot` uid 65534, no privilege escalation, all capabilities
dropped, `RuntimeDefault` seccomp, `automountServiceAccountToken: false`, readiness and liveness probes on
`/`, requests 5m/16Mi and limits 100m/48Mi; digest `sha256:7e919894…` in both `config/images.yaml` and the
overlay; cosign signature verified 2026-10-09 (F18). Not run: a Trivy *config* scan of the Dockerfile and
manifests (F8).

### B.SC-1 ID-constant trace

| Location | Network | Value | original-id or published-at | Matches the latest on-chain version |
| --- | --- | --- | --- | --- |
| seal-client 0.0.19 `deployments` (resolved from npm at build; the only source) | testnet | `seal_policies` `0x0c8f7349…773d`, `PolicyConfig` `0xee0403ba…7d1a` | both (fresh publication 2026-10-09) | Y — seal-policies-sui commit `428e61d`; live bundle read 2026-10-09 |
| access-gate-client 0.0.8 `deployments` | testnet | `access_gate` `0xd7ddaa94…88c9` | original id used (gate type filter) | Y — access-gate-sui commit `7906954`; live bundle read 2026-10-09 |
| `VITE_*`, `src/` literals, `.env.example` | any | none (only key-server object ids, which are not package ids) | — | Y — grep finds no package id in `src/`; the superseded `0x61c4aa…`, `0xa55789…`, `0x8fcf9c39…`, `0x42cc18…` are absent from the live bundle |
| mainnet, localnet | — | none recorded | — | n/a — sealing disabled with the reason |

### B.SC-2 Coupling table

| Move function | Builder | Test asserting target + arguments |
| --- | --- | --- |
| `seal_approve*` (nft-gate, time-lock) | seal-client providers and controller | seal-client tests and weekly live suite; this app's `seal-controller.test.ts` asserts the deployment ids and `PolicyConfig` it passes |
| `sealed_content::publish` | `buildPublishSealedContentTransaction` (seal-client) | seal-client tests; called from `performPublish` with the deployment's `publishedAt` and `PolicyConfig` |

## Section C — Test-coverage & hermetic/live split

### C.1 Coverage grade — B (37/37, 2026-10-09)

Vitest 5.0.3, 7 files: `config.test.ts` (servers, thresholds, custody, no API key), `seal-view.gating.test.ts`
(gating and custody notices), `manifest-guard.test.ts` (schema, network, registry), `sealed-content.test.ts`
(operators-only discovery, indexer), `walrus.test.ts` (permanent store, owner, already-certified, no
publisher, cap, strict read), `seal-controller.test.ts` (ids and `PolicyConfig`), `reseal.test.ts` (re-seal
flow with a mocked controller). The encrypt and decrypt flows, session clearing, the publish pointer,
deep-link handling and mid-flight switches (F11) have no component tests. No Playwright suite exists.
Gating variables: none; the suite is hermetic. The suite is not run by `node-ci.yml` or by the image
release (F9); the npm job runs it.

### C.2 Hermetic vs. live paths

| Path | Hermetic? | Deferred to | Tracking |
| --- | --- | --- | --- |
| Config, gating, manifest, discovery, re-seal wiring | yes | — | `npm test` |
| Real seal / decrypt | no | testnet servers | seal-client `test:integration` and weekly live suite (PASS 2026-10-09 against the new packages); no browser run of this UI |
| nft-gate decrypt with a pass | no | testnet + pass | manual |
| Browser contrast (axe) of this app's own components | no | `@meddleware/ui` gallery covers shared components only | F10 |

## Section D — Deployment-readiness gates

### pre-localnet

- [x] builds; type-check, three linters, unit tests green (2026-10-09); no secrets
- [x] no `v-html`; no dynamic `:href`; no secret `VITE_*`; every variable in `.env.example`

### pre-testnet

- [x] deployed with digest pinning; CSP and HSTS verified live 2026-10-09; `SECURITY.md` present
- [x] trust assumptions disclosed (F6)
- [x] image: digest-pinned bases, non-root, restricted pod, probes and limits, deployed by digest, signed with SBOM and provenance, scanned before signing (F8)
- [x] consumed IDs are the latest on-chain version — live bundle carries `0x0c8f7349…`, `0xee0403ba…` and `0xd7ddaa94…` only (B.SC-1)
- [x] threshold ≤ configured servers; SessionKey cleared on account switch and disconnect (I1, I6)
- [x] live decrypt round trip — seal-client's live testnet suite PASS 2026-10-09 (the UI itself is not browser-run, C.2)
- [ ] every test project runs in CI — F9 (next patch)
- [ ] state invalidated on switch in every view, including in-flight operations — F11 (next patch)
- [ ] signing UX shows what is sealed to — F13 (next patch)
- [ ] colour: text meets AA in both themes — F10 (next patch)

### pre-mainnet

- [ ] mainnet `seal_policies` published and recorded; live round trip on the mainnet servers — mainnet-blocked
- [ ] operators' Open-mode terms confirmed — maintainer item (`OPERATOR_TASKS.md` "Mainnet Seal key servers")
- [ ] UpgradeCap multisig transfer and burn date (CUSTODY.md) or the notice kept — mainnet-blocked (`OPERATOR_TASKS.md` "Mainnet release custody")
- [ ] storage lifetime shown and an extension path stated — F12 (next patch, before mainnet)
- [x] CSP and HSTS on the one hosting path (B.VUE-1)
- [ ] registry credential inventory and rotation (F19) — `OPERATOR_TASKS.md` "Image registry credentials"
- [ ] external review — maintainer item (`OPERATOR_TASKS.md` "Funding, grants and an external audit")

## Cross-project themes

- **Supply chain & release integrity** — lockfile (also shipped in the image); first-party clients at
  their latest versions; signed images with SBOM and provenance, Trivy before signing, SHA-pinned
  actions, grouped Dependabot; expiring audit allowlist; publish authority in B.2.
- **On-chain-truth boundary** — access is decided on-chain and at the key servers.
- **Wire-format coupling** — identity layouts, manifests and approve PTBs are seal-client's; the app only
  validates a manifest against the registry (F1).
- **Deployment readiness** — Section D.
- **Chain-access layering** — all chain and Seal logic in the clients; the `suiBoundary` lint enforces it.
  IDs consumed: B.SC-1.

## Normative requirements (MUST / MUST NOT)

- **SEAL-M1–SEAL-M3, SEAL-M5** — hold through seal-client; **SEAL-M4** — holds (I1); **SEAL-M6–M8**
  — hold (I3); the Confirm step does not repeat the identity inputs (F13).
- **SC-M1–SC-M10** — hold through the libraries (SC-M6 to SC-M9 are N/A: this app verifies no
  signature, binds no event, signs no dry-run PTB and extracts no created object). SC-M5: network, ids,
  client and wallet chain follow one selector.
- **VUE-M1–VUE-M9** — hold (VUE-M3 N/A; VUE-M7 N/A); VUE-M4 holds for the wallet prompts with one gap on
  the Confirm step (F13); VUE-M6 holds for sessions with one gap for in-flight operations (F11); the
  *Colour & links* category has one open defect (F10).
- **WAL-M1–WAL-M9** — hold for the publisher path (WAL-M1 to M3, M8 and M9 are N/A: no relay, tip or gated
  upload); WAL-M4 is not met: the lifetime is not shown (F12).
- **IMG-M1–IMG-M8** — hold; IMG-M8's verification command pins the repository only (F18).
- **TS-M1–TS-M9** — hold; TS-M9: `@mysten/sui` is a single copy, `@mysten/seal` is seal-client's peer,
  wallet-adapter is a peer; the lens's rule that every test project runs in CI is not met (F9); F14 is
  Info.

## Implementation suggestions (SHOULD / MAY)

- SHOULD add `npm test` to `node-ci.yml` (F9) and `color: var(--accent-contrast)` to `button.primary` (F10).
- SHOULD bind each operation to the network and account it started with (F11), and show the end epoch and
  the sealed-to parameters (F12, F13).
- SHOULD add component tests for the encrypt flow (manifest network, owner), the deep-link preselection and
  session clearing.
- MAY show the policy package's custody state (UpgradeCap live or burned) read from its
  `deployments.json` once the burn is recorded.
- MAY run a Trivy configuration scan of the Dockerfile and manifests in CI.

## Open questions (`OQ#`)

None (ADR-0002 OQs decided: D24).

## Risks

- **Key-server collusion or outage** — t servers can decrypt; fewer than t online blocks decryption.
- **Policy upgrades** — until the cap is burned.
- **Walrus availability** — stored ciphertext depends on Walrus storage epochs, and the user is not told
  when they end (F12).
- **Superseded namespaces** — content sealed under earlier testnet `seal_policies` packages no longer
  decrypts (decision: legacy namespaces unsupported).

## Re-verification log

- 2026-09-18 — first-pass baseline (F1–F5).
- 2026-09-28 — F1 RESOLVED; F2, F3 dispositions recorded.
- 2026-10-02 — ADR-0002 / D24: mainnet servers; API-key path removed; custody notice; re-seal.
- 2026-10-02 — re-verified under AUDIT_TEMPLATE.md + VUE + TS + SUI_CLIENT + SEAL + WALRUS + IMG
  (Phase 7): front matter, lens sections and four-part closing added. F6 RESOLVED in 0.0.30 with
  seal-client 0.0.14 and walrus-client 0.0.24. Counts: 31/31.
- 2026-10-03 — consumer wave: 0.0.31 (seal-client 0.0.15, walrus-client 0.0.25, access-gate-client 0.0.4, ui 0.1.30); deployed; live sweep clean.
- 2026-10-08 — Lens dates reconciled with the registry (`check-template-dates.mjs`): base 2026-10-08, and SUI_CLIENT/GO 2026-10-08 and TS 2026-10-03 where cited. The changes (AUTH/PLATFORM/MCP/DB registered, the GO token row moved to AUTH, JSR in trusted publishing, layered injection guards) alter no disposition here.
- 2026-10-09 — re-verified at 0.0.37 (`1c9a03e`) against the code, the workflows, the manifests and the live site/bundle. Template dates now VUE/TS/IMG 2026-10-08; front matter gains the Seal, Walrus, VUE, TS and IMG fields. F1–F6 re-checked (F1 evidence extended to the registry check and the right test file; F2 residual write-side note; F6 still true under the republished package). New: F7 RESOLVED (operator-only discovery, linked and soulbound gates, registry-checked manifests; seal-client 0.0.16–0.0.19), F8 RESOLVED (image release gate, Trivy, notices, lockfile, `USER 65534`, static-server 0.1.7), F9 DEFERRED (the known `node-ci.yml` gap: no `npm test`, present here), F10–F15 DEFERRED (primary button contrast, in-flight operations, hidden storage lifetime, Confirm step omits the sealed-to parameters, TypeScript hygiene, repository hygiene), F16–F18 ACCEPTED-RISK, F19 DEFERRED (maintainer). The design-tokens F10 check (`--warning` as text) is clean here. The republished `seal_policies` `0x0c8f7349…` and `access_gate` `0xd7ddaa94…` are the only ids in the live bundle. Counts: 37/37 (was 31/31), audit gate 1 allowlisted / 0 open. Section D gates ticked with evidence; unticked: four next-patch items (F9–F13), F12 as a pre-mainnet gate, and the mainnet/maintainer items.
