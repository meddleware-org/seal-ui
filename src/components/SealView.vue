<script setup lang="ts">
// Core Sealed Storage tool UI (Encrypt / Decrypt / Unlock), free of any app shell.
// Rendered standalone by seal-ui's App.vue and inline by the dashboard. Wallet state comes from
// the shared @meddleware/wallet-adapter singleton (via ./wallet.js): connecting here or in any
// other inline tool view (or the dashboard header) reflects everywhere.
//
// Styles are scoped to this component so the dashboard can import it without pulling seal-ui's
// global stylesheet (which restyles body / #app / bare inputs). The standalone app keeps those
// globals via main.ts → styles.css.
import { computed, onMounted, ref } from 'vue'
import { Transaction } from '@mysten/sui/transactions'
import {
  buildPublishSealedContentTx,
  type SealedManifest,
  type SealPolicyProvider,
  type SealedContentPointer,
} from '@meddleware/seal-client'
import { useWallet } from '../wallet.js'
import { registry, getSealController } from '../seal.js'
import { storeBlob, readBlob } from '../walrus.js'
import { discoverSealedContent } from '../sealed-content.js'
import { NETWORK, MAINNET_PENDING, SEAL_CONFIGURED, SEAL_PACKAGE_ID } from '../config.js'

const { wallets, account, connect, disconnect, signPersonalMessage, signAndExecute } = useWallet()

const providers = registry.list() as SealPolicyProvider[]
const disabled = computed(() => MAINNET_PENDING || !SEAL_CONFIGURED)

type Tab = 'encrypt' | 'decrypt' | 'unlock'
const tab = ref<Tab>('encrypt')

// Deep-link from access-gate-ui: ?gate=<id> preselects the nft-gate policy + gate.
onMounted(() => {
  const gate = new URLSearchParams(location.search).get('gate')
  if (gate && providers.some((p) => p.type === 'nft-gate')) {
    encType.value = 'nft-gate'
    encValues.value = { ...encValues.value, gateId: gate }
    unlockGateId.value = gate
  }
})
const busy = ref(false)
const status = ref<string | null>(null)
const errorMsg = ref<string | null>(null)

function coerce(kind: string, raw: string | boolean): unknown {
  if (kind === 'boolean') return Boolean(raw)
  if (kind === 'datetime') return Date.parse(String(raw))
  return String(raw)
}

function triggerDownload(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

// ── Encrypt ──────────────────────────────────────────────────────────────────
const encType = ref(providers[0]?.type ?? '')
const encProvider = computed(() => providers.find((p) => p.type === encType.value) ?? null)
const encValues = ref<Record<string, string | boolean>>({})
const encFile = ref<File | null>(null)
const encLabel = ref('')
const manifest = ref<SealedManifest | null>(null)

function onEncFile(e: Event): void {
  encFile.value = (e.target as HTMLInputElement).files?.[0] ?? null
}

async function performEncrypt(): Promise<void> {
  errorMsg.value = null
  status.value = null
  manifest.value = null
  const provider = encProvider.value
  if (!provider) return
  if (!encFile.value) {
    errorMsg.value = 'Choose a file to encrypt.'
    return
  }
  busy.value = true
  try {
    const params: Record<string, unknown> = {}
    for (const f of provider.describe().encryptFields) {
      const v = encValues.value[f.name]
      if (f.required && (v === undefined || v === '')) throw new Error(`${f.label} is required.`)
      if (v !== undefined && v !== '') params[f.name] = coerce(f.kind, v)
    }
    status.value = 'Encrypting…'
    const data = new Uint8Array(await encFile.value.arrayBuffer())
    const { id, ciphertext } = await (await getSealController()).encrypt(provider.type, params, data)
    status.value = 'Storing ciphertext on Walrus…'
    const blobId = await storeBlob(ciphertext)
    manifest.value = {
      policyType: provider.type,
      id,
      blobId,
      network: NETWORK,
      params,
      label: encLabel.value || encFile.value.name,
    }
    status.value = 'Sealed. Keep the manifest below — you need it to decrypt.'
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}

function downloadManifest(): void {
  if (!manifest.value) return
  const blob = new Blob([JSON.stringify(manifest.value, null, 2)], { type: 'application/json' })
  triggerDownload(blob, `${manifest.value.label ?? 'sealed'}.seal.json`)
}

// ── Decrypt ──────────────────────────────────────────────────────────────────
const decManifestText = ref('')
const decValues = ref<Record<string, string | boolean>>({})
const decManifest = computed<SealedManifest | null>(() => {
  if (!decManifestText.value.trim()) return null
  try {
    return JSON.parse(decManifestText.value) as SealedManifest
  } catch {
    return null
  }
})
const decProvider = computed(() =>
  decManifest.value ? (providers.find((p) => p.type === decManifest.value?.policyType) ?? null) : null,
)

async function onManifestFile(e: Event): Promise<void> {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) decManifestText.value = await f.text()
}

async function performDecrypt(): Promise<void> {
  errorMsg.value = null
  status.value = null
  const m = decManifest.value
  const provider = decProvider.value
  if (!m || !provider) {
    errorMsg.value = 'Paste or upload a valid manifest.'
    return
  }
  if (!account.value) {
    errorMsg.value = 'Connect your wallet to decrypt.'
    return
  }
  busy.value = true
  try {
    const params: Record<string, unknown> = { ...(m.params ?? {}) }
    for (const f of provider.describe().decryptFields) {
      const v = decValues.value[f.name]
      if (v !== undefined && v !== '') params[f.name] = coerce(f.kind, v)
      if (f.required && (params[f.name] === undefined || params[f.name] === '')) {
        throw new Error(`${f.label} is required.`)
      }
    }
    status.value = 'Fetching ciphertext from Walrus…'
    const ciphertext = await readBlob(m.blobId)
    status.value = 'Requesting decryption keys — approve the signature in your wallet…'
    const plaintext = await (await getSealController()).decrypt(m.policyType, params, m.id, ciphertext, {
      address: account.value.address,
      signPersonalMessage,
    })
    triggerDownload(new Blob([plaintext.slice().buffer as ArrayBuffer]), m.label ?? 'decrypted')
    status.value = 'Decrypted — download started.'
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}

// ── Publish an on-chain discovery pointer (nft-gate content only) ─────────────
const publishDigest = ref<string | null>(null)

async function performPublish(): Promise<void> {
  errorMsg.value = null
  const m = manifest.value
  if (!m || m.policyType !== 'nft-gate' || !m.params?.gateId) {
    errorMsg.value = 'On-chain publishing is available for access-gate content only.'
    return
  }
  if (!account.value) {
    errorMsg.value = 'Connect your wallet to publish.'
    return
  }
  busy.value = true
  try {
    status.value = 'Publishing on-chain pointer — approve the transaction in your wallet…'
    const tx = new Transaction()
    buildPublishSealedContentTx(tx, SEAL_PACKAGE_ID, {
      gateId: String(m.params.gateId),
      blobId: m.blobId,
      sealId: m.id,
      label: m.label ?? '',
    })
    const { digest } = await signAndExecute(tx)
    publishDigest.value = digest
    status.value = 'Published — gate pass-holders can now discover and unlock this content.'
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}

// ── Unlock: discover a gate's sealed content and decrypt ──────────────────────
const unlockGateId = ref('')
const discovered = ref<SealedContentPointer[]>([])
const unlockNftId = ref('')
const unlockSoulbound = ref(false)

async function performDiscover(): Promise<void> {
  errorMsg.value = null
  discovered.value = []
  if (!unlockGateId.value) {
    errorMsg.value = 'Enter a gate id to search.'
    return
  }
  busy.value = true
  try {
    status.value = 'Searching for sealed content…'
    discovered.value = await discoverSealedContent(unlockGateId.value)
    status.value = discovered.value.length
      ? `Found ${discovered.value.length} item(s).`
      : 'No sealed content published for this gate.'
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}

async function performUnlock(item: SealedContentPointer): Promise<void> {
  errorMsg.value = null
  if (!account.value) {
    errorMsg.value = 'Connect your wallet to decrypt.'
    return
  }
  if (!unlockNftId.value) {
    errorMsg.value = 'Enter your pass NFT id.'
    return
  }
  busy.value = true
  try {
    status.value = 'Fetching ciphertext from Walrus…'
    const ciphertext = await readBlob(item.blobId)
    status.value = 'Requesting decryption keys — approve the signature in your wallet…'
    const plaintext = await (await getSealController()).decrypt(
      'nft-gate',
      { gateId: item.gateId, nftId: unlockNftId.value, soulbound: unlockSoulbound.value },
      item.sealId,
      ciphertext,
      { address: account.value.address, signPersonalMessage },
    )
    triggerDownload(new Blob([plaintext.slice().buffer as ArrayBuffer]), item.label || 'decrypted')
    status.value = 'Decrypted — download started.'
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}

const shortAddr = computed(() => {
  const a = account.value?.address
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : ''
})
</script>

<template>
  <div class="page">
    <p class="muted">Client-side encrypted, access-gated storage on Walrus + Sui.</p>

    <div v-if="MAINNET_PENDING" class="notice notice--warn">
      Mainnet support is pending — Seal committee mode is currently testnet-only. Switch to testnet to
      seal content.
    </div>
    <div v-else-if="!SEAL_CONFIGURED" class="notice notice--warn">
      This deployment has no Seal policy package or key-server committee configured
      (<code>VITE_SEAL_PACKAGE_ID_*</code> / <code>VITE_SEAL_SERVER_OBJECT_IDS_*</code>).
    </div>

    <section class="card" style="display:flex;align-items:center;justify-content:space-between;gap:1rem">
      <template v-if="account">
        <span class="muted">Connected: {{ shortAddr }}</span>
        <button class="link" @click="disconnect">Disconnect</button>
      </template>
      <template v-else>
        <span class="muted">Wallet needed only to decrypt.</span>
        <span>
          <button
            v-for="w in wallets"
            :key="w.name"
            class="primary"
            style="margin-left:0.4rem"
            @click="connect(w)"
          >
            Connect {{ w.name }}
          </button>
          <span v-if="!wallets.length" class="muted">No Sui wallet detected.</span>
        </span>
      </template>
    </section>

    <nav class="tabs">
      <button :class="{ active: tab === 'encrypt' }" @click="tab = 'encrypt'">Encrypt</button>
      <button :class="{ active: tab === 'decrypt' }" @click="tab = 'decrypt'">Decrypt</button>
      <button :class="{ active: tab === 'unlock' }" @click="tab = 'unlock'">Unlock</button>
    </nav>

    <div v-if="errorMsg" class="notice notice--error">{{ errorMsg }}</div>

    <!-- Encrypt -->
    <section v-show="tab === 'encrypt'" class="card">
      <label class="field">
        <span>Policy</span>
        <select v-model="encType" :disabled="disabled">
          <option v-for="p in providers" :key="p.type" :value="p.type">
            {{ p.describe().label }}
          </option>
        </select>
      </label>
      <p v-if="encProvider" class="muted">{{ encProvider.describe().help }}</p>

      <template v-if="encProvider">
        <label
          v-for="f in encProvider.describe().encryptFields"
          :key="f.name"
          class="field"
          :class="{ checkbox: f.kind === 'boolean' }"
        >
          <span>{{ f.label }}<template v-if="f.required"> *</template></span>
          <input v-if="f.kind === 'datetime'" type="datetime-local" v-model="encValues[f.name]" />
          <input v-else-if="f.kind === 'boolean'" type="checkbox" v-model="encValues[f.name]" />
          <input v-else type="text" v-model="encValues[f.name]" :placeholder="f.help" />
        </label>
      </template>

      <label class="field">
        <span>Label (optional)</span>
        <input type="text" v-model="encLabel" placeholder="A name to recognise this later" />
      </label>

      <label class="field">
        <span>File</span>
        <input type="file" @change="onEncFile" />
      </label>

      <button class="primary" :disabled="busy || disabled" @click="performEncrypt">
        {{ busy ? 'Working…' : 'Encrypt & store' }}
      </button>

      <div v-if="manifest" style="margin-top:1rem">
        <p class="muted">Manifest — save this; it's required to decrypt (it holds no secrets):</p>
        <pre class="manifest">{{ JSON.stringify(manifest, null, 2) }}</pre>
        <button class="link" @click="downloadManifest">Download manifest</button>

        <div v-if="manifest.policyType === 'nft-gate'" style="margin-top:0.75rem">
          <p class="muted">
            Optional: publish an on-chain pointer so this gate's pass-holders can discover and unlock
            this content in the Unlock tab (no need to share the manifest).
          </p>
          <button class="primary" :disabled="busy || !account" @click="performPublish">
            {{ busy ? 'Working…' : 'Publish discovery pointer' }}
          </button>
          <span v-if="!account" class="muted"> — connect a wallet first.</span>
          <p v-if="publishDigest" class="muted">Published in tx {{ publishDigest.slice(0, 10) }}…</p>
        </div>
      </div>
    </section>

    <!-- Unlock -->
    <section v-show="tab === 'unlock'" class="card">
      <p class="muted">
        Discover content sealed to an access gate and decrypt it with a pass you hold.
      </p>
      <label class="field">
        <span>Access gate ID</span>
        <input type="text" v-model="unlockGateId" placeholder="0x… gate object id" />
      </label>
      <button class="primary" :disabled="busy || !unlockGateId" @click="performDiscover">
        {{ busy ? 'Working…' : 'Find sealed content' }}
      </button>

      <div v-if="discovered.length" style="margin-top:1rem">
        <label class="field">
          <span>Your pass NFT ID *</span>
          <input type="text" v-model="unlockNftId" placeholder="0x… your AccessNFT for this gate" />
        </label>
        <label class="field checkbox">
          <input type="checkbox" v-model="unlockSoulbound" />
          <span>Pass is soulbound</span>
        </label>

        <div v-for="item in discovered" :key="item.contentId" class="card" style="margin:0.5rem 0">
          <strong>{{ item.label || '(untitled)' }}</strong>
          <p class="muted" style="word-break:break-all">blob {{ item.blobId }}</p>
          <button class="primary" :disabled="busy || !account || !unlockNftId" @click="performUnlock(item)">
            Unlock &amp; download
          </button>
          <span v-if="!account" class="muted"> — connect a wallet to decrypt.</span>
        </div>
      </div>
    </section>

    <!-- Decrypt -->
    <section v-show="tab === 'decrypt'" class="card">
      <label class="field">
        <span>Manifest (paste JSON or upload)</span>
        <textarea v-model="decManifestText" placeholder='{ "policyType": "...", "id": "...", "blobId": "..." }'></textarea>
      </label>
      <input type="file" accept="application/json,.json" @change="onManifestFile" />

      <template v-if="decProvider">
        <p class="muted" style="margin-top:0.75rem">
          Policy: {{ decProvider.describe().label }} — {{ decProvider.describe().help }}
        </p>
        <label
          v-for="f in decProvider.describe().decryptFields"
          :key="f.name"
          class="field"
          :class="{ checkbox: f.kind === 'boolean' }"
        >
          <span>{{ f.label }}<template v-if="f.required"> *</template></span>
          <input v-if="f.kind === 'datetime'" type="datetime-local" v-model="decValues[f.name]" />
          <input v-else-if="f.kind === 'boolean'" type="checkbox" v-model="decValues[f.name]" />
          <input
            v-else
            type="text"
            v-model="decValues[f.name]"
            :placeholder="decManifest?.params?.[f.name] != null ? String(decManifest.params[f.name]) : f.help"
          />
        </label>
      </template>
      <p v-else-if="decManifestText.trim()" class="muted">Unrecognised or invalid manifest.</p>

      <button class="primary" :disabled="busy || !decProvider" @click="performDecrypt">
        {{ busy ? 'Working…' : 'Decrypt' }}
      </button>
    </section>

    <p v-if="status" class="status muted">{{ status }}</p>

    <p class="muted disclaimer">
      Decryption keys are released by a threshold committee of independent key servers. If enough
      servers are unreachable, decryption pauses — storage and retrieval are unaffected.
    </p>
  </div>
</template>

<style scoped>
.page {
  max-width: 780px;
  margin: 0 auto;
  flex: 1;
}

.notice {
  border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
  border-radius: 10px;
  padding: 0.7rem 0.9rem;
  margin: 0.75rem 0;
  font-size: 0.9rem;
}
.notice--warn { background: color-mix(in srgb, #d29922 15%, transparent); }
.notice--error { background: color-mix(in srgb, #f85149 18%, transparent); }

.tabs {
  display: flex;
  gap: 0.25rem;
  margin: 1rem 0;
  border-bottom: 1px solid color-mix(in srgb, currentColor 15%, transparent);
}
.tabs button {
  background: transparent;
  border: 0;
  color: inherit;
  padding: 0.5rem 0.9rem;
  cursor: pointer;
  opacity: 0.7;
  border-bottom: 2px solid transparent;
}
.tabs button.active {
  opacity: 1;
  border-bottom-color: var(--accent, #c0503f);
}

.card {
  background: var(--surface, #1e1917);
  border: 1px solid color-mix(in srgb, currentColor 12%, transparent);
  border-radius: 12px;
  padding: 1rem 1.1rem;
  margin: 0.75rem 0;
}

label.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin: 0.6rem 0;
  font-size: 0.9rem;
}
label.field.checkbox {
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
}

input[type='text'],
input[type='datetime-local'],
textarea,
select {
  background: var(--bg, #14100f);
  color: inherit;
  border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
  border-radius: 8px;
  padding: 0.5rem 0.6rem;
  font: inherit;
  width: 100%;
  box-sizing: border-box;
}
textarea { min-height: 6rem; resize: vertical; font-family: ui-monospace, monospace; font-size: 0.8rem; }

button.primary {
  background: var(--accent, #c0503f);
  color: #fff;
  border: 0;
  border-radius: 8px;
  padding: 0.55rem 1.1rem;
  font-weight: 600;
  cursor: pointer;
}
button.primary:disabled { opacity: 0.5; cursor: default; }

button.link {
  background: transparent;
  border: 0;
  color: var(--accent, #c0503f);
  cursor: pointer;
  padding: 0;
  font: inherit;
}

pre.manifest {
  background: var(--bg, #14100f);
  border-radius: 8px;
  padding: 0.7rem;
  overflow-x: auto;
  font-size: 0.75rem;
}

.muted { color: var(--muted, #a89b96); font-size: 0.85rem; }
.status { font-size: 0.85rem; margin-top: 0.5rem; }
.disclaimer { margin-top: 2rem; }
</style>
