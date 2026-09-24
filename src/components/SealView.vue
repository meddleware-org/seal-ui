<script setup lang="ts">
// Core Sealed Storage tool UI (Encrypt / Decrypt / Unlock), free of any app shell.
// Rendered standalone by seal-ui's App.vue and inline by the dashboard. Wallet state comes from
// the shared @meddleware/wallet-adapter singleton (via ./wallet.js): connecting here or in any
// other inline tool view (or the dashboard header) reflects everywhere.
//
// Styles are scoped to this component so the dashboard can import it without pulling seal-ui's
// global stylesheet (which restyles body / #app / bare inputs). The standalone app keeps those
// globals via main.ts → styles.css.
import { computed, onMounted, ref, watch } from 'vue'
import { AppTabNav, UiStepper, type AppTab, type StepperStep } from '@meddleware/ui'
import { Transaction } from '@mysten/sui/transactions'
import {
  buildPublishSealedContentTx,
  type SealedManifest,
  type SealPolicyProvider,
  type SealedContentPointer,
  type FieldSuggestion,
} from '@meddleware/seal-client'
import { checkManifestForNetwork } from '../manifest-guard.js'
import { WalletGuard } from '@meddleware/wallet-adapter'
import { useWallet, getSuiClient } from '../wallet.js'
import { registry, getSealController } from '../seal.js'
import { storeBlob, readBlob } from '../walrus.js'
import { discoverSealedContent } from '../sealed-content.js'
import { NETWORK, SEAL_CONFIGURED, SEAL_PACKAGE_ID } from '../config.js'

const { account, signPersonalMessage, signAndExecute } = useWallet()

const providers = registry.list() as SealPolicyProvider[]
const disabled = computed(() => !SEAL_CONFIGURED)

const TABS: AppTab[] = [
  { id: 'encrypt', label: 'Encrypt' },
  { id: 'decrypt', label: 'Decrypt' },
  { id: 'unlock', label: 'Unlock' },
]
const tab = ref<string>('encrypt')

const ENC_STEPS: StepperStep[] = [
  { id: 'policy', label: 'Policy' },
  { id: 'details', label: 'Details' },
  { id: 'confirm', label: 'Confirm' },
]
const DEC_STEPS: StepperStep[] = [
  { id: 'manifest', label: 'Manifest' },
  { id: 'decrypt', label: 'Decrypt' },
]
const UNLOCK_STEPS: StepperStep[] = [
  { id: 'gate', label: 'Gate' },
  { id: 'unlock', label: 'Unlock' },
]

const encStep = ref(0)
const decStep = ref(0)
const unlockStep = ref(0)

watch(tab, () => {
  encStep.value = 0
  decStep.value = 0
  unlockStep.value = 0
})

// Deep-link from access-gate-ui: ?gate=<id> preselects the nft-gate policy + gate.
// Force manual mode so the pre-set ID renders in the text input immediately, before suggestions load.
onMounted(() => {
  const gate = new URLSearchParams(location.search).get('gate')
  if (gate && providers.some((p) => p.type === 'nft-gate')) {
    encType.value = 'nft-gate'
    encValues.value = { ...encValues.value, gateId: gate }
    encGateManual.value = true
    unlockGateId.value = gate
    unlockGateManual.value = true
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

// ── Gate suggestions (nft-gate policy) ───────────────────────────────────────
const encGateSuggestions = ref<FieldSuggestion[]>([])
const encGateManual = ref(false)
const encGateLoading = ref(false)
const unlockGateSuggestions = ref<FieldSuggestion[]>([])
const unlockGateManual = ref(false)
const unlockGateLoading = ref(false)

async function fetchGateSuggestions(provider: SealPolicyProvider | null): Promise<FieldSuggestion[]> {
  const addr = account.value?.address
  if (!addr || !provider || !provider.suggest) return []
  const result = await provider.suggest({ account: addr, client: getSuiClient() })
  return result.gateId ?? []
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

watch(
  [() => account.value?.address, encProvider],
  async ([, provider]) => {
    if (encType.value !== 'nft-gate') { encGateSuggestions.value = []; return }
    encGateLoading.value = true
    encGateManual.value = false
    try {
      encGateSuggestions.value = await fetchGateSuggestions(provider)
    } catch {
      encGateSuggestions.value = []
    } finally {
      encGateLoading.value = false
    }
  },
)

watch(
  [() => account.value?.address, tab],
  async ([, t]) => {
    if (t !== 'unlock') return
    const nftGateProvider = providers.find((p) => p.type === 'nft-gate') ?? null
    unlockGateLoading.value = true
    unlockGateManual.value = false
    try {
      unlockGateSuggestions.value = await fetchGateSuggestions(nftGateProvider)
    } catch {
      unlockGateSuggestions.value = []
    } finally {
      unlockGateLoading.value = false
    }
  },
)

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
    encStep.value = 2
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
// Validate the pasted/loaded manifest through the shared schema guard (rejects malformed shapes)
// AND enforce that it targets the network this app is built for — a manifest sealed on another
// network references a package + committee that don't exist here and can never decrypt. The
// `decManifestError` is surfaced next to the input so a rejection explains itself.
const decCheck = computed(() => checkManifestForNetwork(decManifestText.value, NETWORK))
const decManifest = computed<SealedManifest | null>(() => decCheck.value.manifest)
const decManifestError = computed<string | null>(() => decCheck.value.error)
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
    if (discovered.value.length) unlockStep.value = 1
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

</script>

<template>
  <div class="page">
    <p class="muted">Client-side encrypted, access-gated storage on Walrus + Sui.</p>

    <div v-if="!SEAL_CONFIGURED" class="notice notice--warn">
      <template v-if="NETWORK === 'mainnet'">
        Seal is not configured for mainnet. Set
        <code>VITE_SEAL_PACKAGE_ID_MAINNET</code>,
        <code>VITE_SEAL_SERVER_OBJECT_IDS_MAINNET</code>, and
        <code>VITE_SEAL_AGGREGATOR_URLS_MAINNET</code>, then redeploy.
      </template>
      <template v-else>
        This deployment has no Seal policy package or key-server committee configured
        (<code>VITE_SEAL_PACKAGE_ID_*</code> / <code>VITE_SEAL_SERVER_OBJECT_IDS_*</code>).
      </template>
    </div>

    <WalletGuard message="Connect a Sui wallet to encrypt and decrypt sealed content.">
    <AppTabNav :tabs="TABS" v-model="tab" style="margin: 1rem 0" />

    <div v-if="errorMsg" class="notice notice--error">{{ errorMsg }}</div>

    <!-- Encrypt -->
    <section v-show="tab === 'encrypt'" class="card">
      <UiStepper :steps="ENC_STEPS" v-model="encStep" />

      <!-- Step 0: Policy -->
      <template v-if="encStep === 0">
        <label class="field">
          <span>Policy</span>
          <select v-model="encType" :disabled="disabled">
            <option v-for="p in providers" :key="p.type" :value="p.type">
              {{ p.describe().label }}
            </option>
          </select>
        </label>
        <p v-if="encProvider" class="muted">{{ encProvider.describe().help }}</p>
        <div class="nav-row">
          <button type="button" class="primary" :disabled="disabled || !encProvider" @click="encStep++">Next</button>
        </div>
      </template>

      <!-- Step 1: Details (policy fields + file + label) -->
      <template v-else-if="encStep === 1">
        <template v-if="encProvider">
          <template v-for="f in encProvider.describe().encryptFields" :key="f.name">
            <!-- Gate ID field: show a picker when wallet-owned gates are available -->
            <label v-if="f.name === 'gateId'" class="field">
              <span>{{ f.label }}<template v-if="f.required"> *</template></span>
              <span v-if="encGateLoading" class="muted" style="font-size:0.8rem">Loading your gates…</span>
              <template v-else-if="encGateSuggestions.length && !encGateManual">
                <select v-model="encValues[f.name]">
                  <option value="">Select a gate…</option>
                  <option v-for="s in encGateSuggestions" :key="s.value" :value="s.value">{{ s.label }}</option>
                </select>
                <button class="link" style="margin-top:0.25rem" @click="encGateManual = true; encValues[f.name] = ''">Enter ID manually</button>
              </template>
              <template v-else>
                <input type="text" v-model="encValues[f.name]" :placeholder="f.help" />
                <button v-if="encGateSuggestions.length" class="link" style="margin-top:0.25rem" @click="encGateManual = false; encValues[f.name] = ''">← Back to picker</button>
              </template>
            </label>
            <!-- All other fields: generic rendering -->
            <label v-else class="field" :class="{ checkbox: f.kind === 'boolean' }">
              <span>{{ f.label }}<template v-if="f.required"> *</template></span>
              <input v-if="f.kind === 'datetime'" type="datetime-local" v-model="encValues[f.name]" />
              <input v-else-if="f.kind === 'boolean'" type="checkbox" v-model="encValues[f.name]" />
              <input v-else type="text" v-model="encValues[f.name]" :placeholder="f.help" />
            </label>
          </template>
        </template>

        <label class="field">
          <span>Label (optional)</span>
          <input type="text" v-model="encLabel" placeholder="A name to recognise this later" />
        </label>

        <label class="field">
          <span>File</span>
          <input type="file" @change="onEncFile" />
        </label>

        <div class="nav-row">
          <button type="button" class="link" @click="encStep--">Back</button>
          <button type="button" class="primary" :disabled="disabled || !encFile" @click="encStep++">Next</button>
        </div>
      </template>

      <!-- Step 2: Confirm + encrypt -->
      <template v-else-if="encStep === 2">
        <div v-if="!manifest" class="confirm-summary">
          <p class="muted">Policy: <strong>{{ encProvider?.describe().label }}</strong></p>
          <p class="muted">File: <strong>{{ encFile?.name ?? '—' }}</strong></p>
          <p v-if="encLabel" class="muted">Label: <strong>{{ encLabel }}</strong></p>
        </div>

        <button v-if="!manifest" class="primary" :disabled="busy || disabled" @click="performEncrypt">
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

        <div v-if="!manifest" class="nav-row">
          <button type="button" class="link" @click="encStep--">Back</button>
        </div>
      </template>
    </section>

    <!-- Unlock -->
    <section v-show="tab === 'unlock'" class="card">
      <UiStepper :steps="UNLOCK_STEPS" v-model="unlockStep" />

      <!-- Step 0: Gate selector -->
      <template v-if="unlockStep === 0">
        <p class="muted">
          Discover content sealed to an access gate and decrypt it with a pass you hold.
        </p>
        <label class="field">
          <span>Access gate ID</span>
          <span v-if="unlockGateLoading" class="muted" style="font-size:0.8rem">Loading your gates…</span>
          <template v-else-if="unlockGateSuggestions.length && !unlockGateManual">
            <select v-model="unlockGateId">
              <option value="">Select a gate…</option>
              <option v-for="s in unlockGateSuggestions" :key="s.value" :value="s.value">{{ s.label }}</option>
            </select>
            <button class="link" style="margin-top:0.25rem" @click="unlockGateManual = true; unlockGateId = ''">Enter ID manually</button>
          </template>
          <template v-else>
            <input type="text" v-model="unlockGateId" placeholder="0x… gate object id" />
            <button v-if="unlockGateSuggestions.length" class="link" style="margin-top:0.25rem" @click="unlockGateManual = false; unlockGateId = ''">← Back to picker</button>
          </template>
        </label>
        <button class="primary" :disabled="busy || !unlockGateId" @click="performDiscover">
          {{ busy ? 'Working…' : 'Find sealed content' }}
        </button>
      </template>

      <!-- Step 1: Results + unlock -->
      <template v-else-if="unlockStep === 1">
        <div v-if="!discovered.length" class="muted">No sealed content found for this gate.</div>

        <div v-if="discovered.length">
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

        <div class="nav-row">
          <button type="button" class="link" @click="unlockStep--; discovered = []">Back</button>
        </div>
      </template>
    </section>

    <!-- Decrypt -->
    <section v-show="tab === 'decrypt'" class="card">
      <UiStepper :steps="DEC_STEPS" v-model="decStep" />

      <!-- Step 0: Manifest input -->
      <template v-if="decStep === 0">
        <label class="field">
          <span>Manifest (paste JSON or upload)</span>
          <textarea v-model="decManifestText" placeholder='{ "policyType": "...", "id": "...", "blobId": "..." }'></textarea>
        </label>
        <input type="file" accept="application/json,.json" @change="onManifestFile" />
        <p v-if="decManifestError" class="muted">{{ decManifestError }}</p>
        <p v-else-if="decManifestText.trim() && !decManifest" class="muted">Unrecognised or invalid manifest.</p>
        <div class="nav-row">
          <button type="button" class="primary" :disabled="!decManifest" @click="decStep++">Next</button>
        </div>
      </template>

      <!-- Step 1: Policy fields + decrypt -->
      <template v-else-if="decStep === 1">
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

        <div class="nav-row">
          <button type="button" class="link" @click="decStep--">Back</button>
          <button class="primary" :disabled="busy || !decProvider" @click="performDecrypt">
            {{ busy ? 'Working…' : 'Decrypt' }}
          </button>
        </div>
      </template>
    </section>

    <p v-if="status" class="status muted">{{ status }}</p>

    <p class="muted disclaimer">
      Decryption keys are released by a threshold committee of independent key servers. If enough
      servers are unreachable, decryption pauses — storage and retrieval are unaffected.
    </p>
    </WalletGuard>
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

.confirm-summary {
  padding: 0.6rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin-bottom: 0.75rem;
}

.nav-row {
  display: flex;
  gap: 0.6rem;
  justify-content: flex-end;
  align-items: center;
  margin-top: 0.75rem;
}

.muted { color: var(--muted, #a89b96); font-size: 0.85rem; }
.status { font-size: 0.85rem; margin-top: 0.5rem; }
.disclaimer { margin-top: 2rem; }
</style>
