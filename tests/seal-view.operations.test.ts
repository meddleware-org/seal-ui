import { describe, it, expect, vi, afterEach } from 'vitest'
import { computed, ref, nextTick } from 'vue'
import { shallowMount, flushPromises } from '@vue/test-utils'

// SealView with its wiring mocked: network and account are refs the test switches mid-operation,
// and every slow dependency is a promise the test settles by hand. Covers audit F11 (a result that
// arrives after a switch is dropped), F12 (the lifetime is shown) and F13 (the Confirm step shows
// what the content is sealed to; a gate from a link needs an explicit OK).
const GATE = `0x${'a1'.repeat(32)}`
const OPERATOR = `0x${'0b'.repeat(32)}`

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const nftProvider = {
  type: 'nft-gate',
  describe: () => ({
    type: 'nft-gate',
    label: 'Access-gate NFT',
    help: 'help',
    encryptFields: [{ name: 'gateId', label: 'Access gate ID', kind: 'objectId', required: true }],
    decryptFields: [],
  }),
}

interface Setup {
  network: string
  address: string | null
  search?: string
}

async function mountView(setup: Setup = { network: 'testnet', address: '0xowner' }) {
  vi.resetModules()
  const network = ref(setup.network)
  const address = ref<string | null>(setup.address)
  const cfgFor = (n: string) => ({
    network: n,
    problem: null,
    custody: 'independent',
    threshold: 2,
    walrusEpochs: 5,
    walrusPublisher: `https://publisher.${n}.example`,
    walrusAggregator: `https://aggregator.${n}.example`,
    seal: { originalId: '0x1', publishedAt: '0x1', policyConfigId: '0x2' },
  })
  const encrypt = vi.fn()
  const storeBlob = vi.fn()
  const readBlob = vi.fn()
  const gateOperatorsFor = vi.fn(async () => [OPERATOR])
  const discoverSealedContent = vi.fn()
  vi.doMock('../src/config.js', () => ({
    network,
    activeConfig: computed(() => cfgFor(network.value)),
  }))
  vi.doMock('../src/wallet.js', () => ({
    useWallet: () => ({
      account: computed(() => (address.value ? { address: address.value } : null)),
      signPersonalMessage: vi.fn(),
      signAndExecute: vi.fn(),
    }),
    getSuiClient: () => ({}),
  }))
  vi.doMock('../src/seal.js', () => ({
    registry: computed(() => ({ list: () => [nftProvider] })),
    getSealController: vi.fn(async () => ({ encrypt })),
    clearSealSessions: vi.fn(),
    resealCiphertext: vi.fn(),
  }))
  vi.doMock('../src/walrus.js', () => ({ storeBlob, readBlob }))
  vi.doMock('../src/sealed-content.js', () => ({ discoverSealedContent, gateOperatorsFor }))
  if (setup.search) window.history.replaceState({}, '', setup.search)
  const { default: SealView } = await import('../src/components/SealView.vue')
  const wrapper = shallowMount(SealView, { global: { renderStubDefaultSlot: true } })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the script-setup state, for driving the view
  const vm = wrapper.vm as any
  return { wrapper, vm, network, address, encrypt, storeBlob, readBlob, gateOperatorsFor, discoverSealedContent }
}

function file() {
  return new File([new Uint8Array([1, 2, 3])], 'secret.txt')
}

afterEach(() => {
  window.history.replaceState({}, '', '/')
  vi.resetModules()
})

describe('F11: an in-flight operation never finishes against another network or account', () => {
  it('drops a seal that completes after a network switch: no manifest, nothing stored on the new network', async () => {
    const t = await mountView()
    const sealed = deferred<{ id: string; ciphertext: Uint8Array }>()
    t.encrypt.mockReturnValue(sealed.promise)
    t.vm.encFile = file()
    t.vm.encValues = { gateId: GATE }
    const run = t.vm.performEncrypt()
    await flushPromises()
    expect(t.vm.busy).toBe(true)

    t.network.value = 'mainnet'
    expect(t.vm.busy).toBe(false)
    expect(t.vm.status).toMatch(/discarded/)

    sealed.resolve({ id: 'ff', ciphertext: new Uint8Array([9]) })
    await run
    await flushPromises()
    expect(t.storeBlob).not.toHaveBeenCalled()
    expect(t.vm.manifest).toBeNull()
    expect(t.vm.busy).toBe(false)
  })

  it('drops a stored blob that completes after a network switch', async () => {
    const t = await mountView()
    t.encrypt.mockResolvedValue({ id: 'ff', ciphertext: new Uint8Array([9]) })
    const stored = deferred<{ blobId: string; endEpoch: number }>()
    t.storeBlob.mockReturnValue(stored.promise)
    t.vm.encFile = file()
    t.vm.encValues = { gateId: GATE }
    const run = t.vm.performEncrypt()
    await flushPromises()
    expect(t.storeBlob).toHaveBeenCalledTimes(1)
    // The store is bound to the configuration the operation started with, not the active one.
    expect(t.storeBlob.mock.calls[0][1].config.network).toBe('testnet')
    expect(t.storeBlob.mock.calls[0][1].sendObjectTo).toBe('0xowner')

    t.network.value = 'mainnet'
    stored.resolve({ blobId: 'B1', endEpoch: 12 })
    await run
    await flushPromises()
    expect(t.vm.manifest).toBeNull()
    expect(t.vm.encStep).toBe(0)
  })

  it('drops a result that completes after an account switch (the Blob object went to the previous account)', async () => {
    const t = await mountView()
    t.encrypt.mockResolvedValue({ id: 'ff', ciphertext: new Uint8Array([9]) })
    const stored = deferred<{ blobId: string }>()
    t.storeBlob.mockReturnValue(stored.promise)
    t.vm.encFile = file()
    t.vm.encValues = { gateId: GATE }
    const run = t.vm.performEncrypt()
    await flushPromises()
    t.address.value = '0xother'
    stored.resolve({ blobId: 'B1' })
    await run
    await flushPromises()
    expect(t.vm.manifest).toBeNull()
  })

  it('labels the manifest with the network the seal started on', async () => {
    const t = await mountView()
    t.encrypt.mockResolvedValue({ id: 'ff', ciphertext: new Uint8Array([9]) })
    t.storeBlob.mockResolvedValue({ blobId: 'B1', endEpoch: 12 })
    t.vm.encFile = file()
    t.vm.encValues = { gateId: GATE }
    await t.vm.performEncrypt()
    expect(t.vm.manifest.network).toBe('testnet')
    expect(t.vm.manifest.blobId).toBe('B1')
  })

  it('drops a discovery that completes after a network switch', async () => {
    const t = await mountView()
    const found = deferred<unknown[]>()
    t.discoverSealedContent.mockReturnValue(found.promise)
    t.vm.unlockGateId = GATE
    const run = t.vm.performDiscover()
    await flushPromises()
    t.network.value = 'mainnet'
    found.resolve([{ contentId: 'c', blobId: 'b', sealId: 's', gateId: GATE, label: 'x', publisher: '0x1' }])
    await run
    await flushPromises()
    expect(t.vm.discovered).toEqual([])
    expect(t.vm.unlockStep).toBe(0)
    expect(t.discoverSealedContent.mock.calls[0][1].config.network).toBe('testnet')
  })

  it('drops a failure from a discarded operation instead of showing it on the new network', async () => {
    const t = await mountView()
    const found = deferred<unknown[]>()
    t.discoverSealedContent.mockReturnValue(found.promise)
    t.vm.unlockGateId = GATE
    const run = t.vm.performDiscover()
    await flushPromises()
    t.network.value = 'mainnet'
    found.reject(new Error('old network failed'))
    await run
    await flushPromises()
    expect(t.vm.errorMsg).toBeNull()
  })

  it('lets an operation started after the switch complete normally', async () => {
    const t = await mountView()
    t.network.value = 'mainnet'
    t.discoverSealedContent.mockResolvedValue([])
    t.vm.unlockGateId = GATE
    await t.vm.performDiscover()
    expect(t.vm.status).toBe('No sealed content published for this gate.')
    expect(t.vm.busy).toBe(false)
  })
})

describe('F12: the storage lifetime is shown', () => {
  it('shows the epochs on the Confirm step and the end epoch on the result', async () => {
    const t = await mountView()
    t.vm.encType = 'nft-gate'
    t.vm.encValues = { gateId: GATE }
    t.vm.encStep = 2
    await nextTick()
    expect(t.wrapper.text()).toContain('5 epochs')

    t.encrypt.mockResolvedValue({ id: 'ff', ciphertext: new Uint8Array([9]) })
    t.storeBlob.mockResolvedValue({ blobId: 'B1', endEpoch: 17, blobObjectId: '0xblobobj' })
    t.vm.encFile = file()
    await t.vm.performEncrypt()
    await nextTick()
    const text = t.wrapper.text()
    expect(text).toContain('through epoch 17')
    expect(text).toContain('0xblobobj')
    expect(t.wrapper.find('.enc-lifetime a').attributes('href')).toBe('https://sui-walrus.meddleware.co.uk/')
  })

  it('says so when the publisher did not report the end epoch', async () => {
    const t = await mountView()
    t.encrypt.mockResolvedValue({ id: 'ff', ciphertext: new Uint8Array([9]) })
    t.storeBlob.mockResolvedValue({ blobId: 'B1' })
    t.vm.encFile = file()
    t.vm.encValues = { gateId: GATE }
    await t.vm.performEncrypt()
    await nextTick()
    expect(t.wrapper.text()).toContain('did not report the end epoch')
  })
})

describe('F13: the Confirm step shows what the content is sealed to', () => {
  it('lists the gate id and the gate operator read from the chain', async () => {
    const t = await mountView()
    t.vm.encType = 'nft-gate'
    t.vm.encValues = { gateId: GATE }
    t.vm.encStep = 2
    await flushPromises()
    const text = t.wrapper.text()
    expect(text).toContain(GATE)
    expect(text).toContain(OPERATOR)
    expect(t.gateOperatorsFor).toHaveBeenCalledWith(GATE, expect.objectContaining({ network: 'testnet' }))
  })

  it('warns when the gate cannot be read as a gate of this network', async () => {
    const t = await mountView()
    t.gateOperatorsFor.mockRejectedValueOnce(new Error('not a Gate of this package'))
    t.vm.encType = 'nft-gate'
    t.vm.encValues = { gateId: GATE }
    t.vm.encStep = 2
    await flushPromises()
    expect(t.wrapper.text()).toContain('could not be read as an access gate')
    expect(t.wrapper.text()).toContain('not a Gate of this package')
  })

  it('requires an explicit confirmation of a gate preselected by a ?gate= link', async () => {
    const t = await mountView({ network: 'testnet', address: '0xowner', search: `/?gate=${GATE}` })
    t.vm.encStep = 2
    await flushPromises()
    expect(t.vm.encValues.gateId).toBe(GATE)
    expect(t.wrapper.text()).toContain('preselected by a link')
    const button = () => t.wrapper.findAll('button.primary').find((b) => b.text().includes('Encrypt'))!
    expect(button().attributes('disabled')).toBeDefined()

    // Even if the button were activated, the operation itself refuses.
    t.vm.encFile = file()
    await t.vm.performEncrypt()
    expect(t.vm.errorMsg).toMatch(/Confirm that you want to seal to the gate from the link/)
    expect(t.encrypt).not.toHaveBeenCalled()

    await t.wrapper.find('.notice input[type="checkbox"]').setValue(true)
    expect(button().attributes('disabled')).toBeUndefined()
  })

  it('does not ask again once the user has chosen a different gate themselves', async () => {
    const t = await mountView({ network: 'testnet', address: '0xowner', search: `/?gate=${GATE}` })
    t.vm.encValues = { gateId: `0x${'c2'.repeat(32)}` }
    t.vm.encStep = 2
    await flushPromises()
    expect(t.wrapper.text()).not.toContain('preselected by a link')
  })

  it('does not ask when no link was followed', async () => {
    const t = await mountView()
    t.vm.encType = 'nft-gate'
    t.vm.encValues = { gateId: GATE }
    t.vm.encStep = 2
    await flushPromises()
    expect(t.wrapper.text()).not.toContain('preselected by a link')
  })
})
