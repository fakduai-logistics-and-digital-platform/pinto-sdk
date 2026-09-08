import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PintoMiniApp, createPintoMiniApp } from '../miniapp.js'
import type { BridgeMessage, MiniAppRegistration, MiniAppScope } from '../miniapp-types.js'

const APP_ID = 'pinto-app_VJjhiXZl1I3qnEuGWWtpU0ve'

function registration(overrides: Partial<MiniAppRegistration> = {}): MiniAppRegistration {
  return {
    app_id: APP_ID,
    name: 'Shop Mini App',
    endpoint_url: 'https://miniapp.example.com',
    bot_id: 'shop_bot',
    scopes: ['openid', 'profile'],
    allowed_domains: ['https://shop.example.com'],
    is_active: true,
    ...overrides,
  }
}

/** Stub the Developer Portal lookup that init() performs. */
function mockLookup(config: MiniAppRegistration | null, status = 200) {
  const fetchMock = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => (config ? { ok: true, data: config, error: null } : { ok: false, data: null, error: 'nope' }),
  }))
  vi.stubGlobal('fetch', fetchMock)

  return fetchMock
}

/**
 * Stand in for the Android shell: capture what the SDK posts, then answer through
 * the global callback exactly the way the native side would (spec §4.2).
 */
function installFakeAndroidShell(handler: (msg: BridgeMessage) => unknown) {
  const sent: BridgeMessage[] = []

  ;(globalThis as Record<string, unknown>).PintoBridge = {
    postMessage: (raw: string) => {
      const msg = JSON.parse(raw) as BridgeMessage
      sent.push(msg)

      queueMicrotask(() => {
        const cb = (globalThis as Record<string, unknown>).__pinto_callback__ as
          | ((id: string, res: unknown) => void)
          | undefined
        if (!cb) return

        try {
          cb(msg.callbackId, { success: true, data: handler(msg), error: null })
        } catch (err) {
          cb(msg.callbackId, { success: false, data: null, error: (err as Error).message })
        }
      })
    },
  }

  return sent
}

function removeFakeShell() {
  delete (globalThis as Record<string, unknown>).PintoBridge
  delete (globalThis as Record<string, unknown>).__pinto_callback__
}

async function initMock(scopes: MiniAppScope[] = ['openid', 'profile']): Promise<PintoMiniApp> {
  mockLookup(registration({ scopes }))
  const pinto = createPintoMiniApp()
  await pinto.init({ appId: APP_ID, mock: true })

  return pinto
}

beforeEach(() => {
  vi.stubGlobal('window', globalThis as unknown as Window)
})

afterEach(() => {
  removeFakeShell()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('PintoMiniApp - init', () => {
  it('requires an appId', async () => {
    const pinto = createPintoMiniApp()

    await expect(pinto.init({ appId: '' })).rejects.toThrow(/appId is required/)
  })

  it('resolves the registration from the Developer Portal', async () => {
    const fetchMock = mockLookup(registration())
    const pinto = createPintoMiniApp()

    await pinto.init({ appId: APP_ID, mock: true, apiBaseUrl: 'https://portal.test' })

    expect(fetchMock).toHaveBeenCalledWith(`https://portal.test/api/v1/mini-apps/lookup/${APP_ID}`)
    expect(pinto.getRegistration()?.name).toBe('Shop Mini App')
  })

  it('fails loudly when the app id cannot be resolved', async () => {
    mockLookup(null, 404)
    const pinto = createPintoMiniApp()

    await expect(pinto.init({ appId: APP_ID, mock: true })).rejects.toThrow(/could not be resolved/)
  })

  it('refuses every call before init', () => {
    const pinto = createPintoMiniApp()

    expect(() => pinto.getContext()).toThrow(/Call pinto.init/)
  })
})

describe('PintoMiniApp - environment', () => {
  it('reports mock mode as out-of-client', async () => {
    const pinto = await initMock()

    expect(pinto.isInClient()).toBe(false)
    expect(pinto.getContext()).toMatchObject({ type: 'external', appId: APP_ID })
  })

  it('detects the native shell and loads the chat context', async () => {
    installFakeAndroidShell((msg) =>
      msg.action === 'getContext' ? { type: 'group', chatId: 'c_42', appId: APP_ID } : undefined
    )
    mockLookup(registration())

    const pinto = createPintoMiniApp()
    await pinto.init({ appId: APP_ID })

    expect(pinto.isInClient()).toBe(true)
    expect(pinto.getContext()).toMatchObject({ type: 'group', chatId: 'c_42' })

    pinto.dispose()
  })

  it('does NOT auto-mock a published app opened in an ordinary browser', async () => {
    // No native shell and a real hostname: real users must reach real OAuth,
    // never a fabricated mock profile.
    vi.stubGlobal('window', { location: { hostname: 'shop.example.com', href: 'https://shop.example.com/' } })
    mockLookup(registration())

    const pinto = createPintoMiniApp()
    await pinto.init({ appId: APP_ID })

    expect(pinto.isMock()).toBe(false)
    expect(pinto.isInClient()).toBe(false)

    pinto.dispose()
  })

  it('auto-mocks on localhost so a desktop dev needs no device', async () => {
    vi.stubGlobal('window', { location: { hostname: 'localhost', href: 'http://localhost:5173/' } })
    mockLookup(registration())

    const pinto = createPintoMiniApp()
    await pinto.init({ appId: APP_ID })

    expect(pinto.isMock()).toBe(true)
    await expect(pinto.getProfile()).resolves.toMatchObject({ displayName: expect.any(String) })

    pinto.dispose()
  })

  it('mock: false disables mocking even on localhost', async () => {
    vi.stubGlobal('window', { location: { hostname: 'localhost', href: 'http://localhost:5173/' } })
    mockLookup(registration())

    const pinto = createPintoMiniApp()
    await pinto.init({ appId: APP_ID, mock: false })

    expect(pinto.isMock()).toBe(false)

    pinto.dispose()
  })
})

describe('PintoMiniApp - scope gating', () => {
  it('blocks scanCode when scan_qr was not granted', async () => {
    const pinto = await initMock(['openid', 'profile'])

    await expect(pinto.scanCode()).rejects.toThrow(/'scan_qr' scope/)
  })

  it('blocks sendMessages when chat_message.write was not granted', async () => {
    const pinto = await initMock(['openid', 'profile'])

    await expect(pinto.sendMessages([{ type: 'text', text: 'hi' }])).rejects.toThrow(
      /'chat_message.write' scope/
    )
  })

  it('blocks shareTargetPicker when share_target_picker was not granted', async () => {
    const pinto = await initMock(['openid', 'profile'])

    await expect(pinto.shareTargetPicker([{ type: 'text', text: 'hi' }])).rejects.toThrow(
      /'share_target_picker' scope/
    )
  })

  it('scope check runs before the in-client check, naming the real blocker', async () => {
    const pinto = await initMock(['openid', 'profile'])

    // Out of client AND missing the scope: the developer should hear about the
    // scope, which is the thing they can fix in the portal.
    await expect(pinto.scanCode()).rejects.toThrow(/scope/)
  })

  it('exposes the granted scopes', async () => {
    const pinto = await initMock(['openid', 'profile', 'scan_qr'])

    expect(pinto.getGrantedScopes()).toEqual(['openid', 'profile', 'scan_qr'])
  })
})

describe('PintoMiniApp - in-client guards', () => {
  it('refuses native-only calls in an external browser even when granted', async () => {
    const pinto = await initMock(['openid', 'profile', 'scan_qr'])

    await expect(pinto.scanCode()).rejects.toThrow(/only works inside the Pinto app/)
  })

  it('runs native-only calls through the bridge when in client', async () => {
    const sent = installFakeAndroidShell((msg) => {
      if (msg.action === 'getContext') return { type: 'utou', appId: APP_ID }
      if (msg.action === 'scanCode') return { value: 'https://pinto-app.com/order/12345', format: 'QR_CODE' }

      return undefined
    })
    mockLookup(registration({ scopes: ['openid', 'profile', 'scan_qr'] }))

    const pinto = createPintoMiniApp()
    await pinto.init({ appId: APP_ID })

    const result = await pinto.scanCode()

    expect(result.value).toBe('https://pinto-app.com/order/12345')
    expect(sent.map((m) => m.action)).toContain('scanCode')
    // Every outbound message carries a unique callbackId (spec §4.1).
    expect(new Set(sent.map((m) => m.callbackId)).size).toBe(sent.length)

    pinto.dispose()
  })

  it('surfaces a native error instead of resolving', async () => {
    installFakeAndroidShell((msg) => {
      if (msg.action === 'getContext') return { type: 'utou', appId: APP_ID }
      throw new Error('user cancelled the scan')
    })
    mockLookup(registration({ scopes: ['openid', 'profile', 'scan_qr'] }))

    const pinto = createPintoMiniApp()
    await pinto.init({ appId: APP_ID })

    await expect(pinto.scanCode()).rejects.toThrow(/user cancelled the scan/)

    pinto.dispose()
  })

  it('closeWindow is a no-op outside the client rather than an error', async () => {
    const pinto = await initMock()

    await expect(pinto.closeWindow()).resolves.toBeUndefined()
  })
})

describe('PintoMiniApp - mock bridge (spec 4.3)', () => {
  it('returns a usable profile without a device', async () => {
    const pinto = await initMock(['openid', 'profile'])

    const profile = await pinto.getProfile()

    expect(profile.userId).toBeTruthy()
    expect(profile.displayName).toBeTruthy()
  })

  it('honours a custom mockProfile', async () => {
    mockLookup(registration())
    const pinto = createPintoMiniApp()

    await pinto.init({
      appId: APP_ID,
      mock: true,
      mockProfile: { userId: 'U_test', displayName: 'ทดสอบ', email: 't@example.com' },
    })

    await expect(pinto.getProfile()).resolves.toMatchObject({ userId: 'U_test', displayName: 'ทดสอบ' })
  })

  it('treats the mock user as signed in so the dev flow is not sent to real SSO', async () => {
    const pinto = await initMock()

    expect(pinto.isMock()).toBe(true)
    expect(pinto.isLoggedIn()).toBe(true)
    await expect(pinto.checkLoggedIn()).resolves.toBe(true)
  })
})

describe('PintoMiniApp - getDecodedIDToken', () => {
  function jwt(payload: Record<string, unknown>): string {
    const b64 = (obj: unknown) =>
      btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(obj))))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')

    return `${b64({ alg: 'HS256' })}.${b64(payload)}.sig`
  }

  it('decodes claims, including non-ASCII ones', async () => {
    installFakeAndroidShell((msg) => {
      if (msg.action === 'getContext') return { type: 'utou', appId: APP_ID }
      if (msg.action === 'getIDToken') return jwt({ sub: 'U_1', name: 'สมชาย', exp: 1893456000 })

      return undefined
    })
    mockLookup(registration())

    const pinto = createPintoMiniApp()
    await pinto.init({ appId: APP_ID })

    const claims = await pinto.getDecodedIDToken()

    expect(claims).toMatchObject({ sub: 'U_1', name: 'สมชาย' })

    pinto.dispose()
  })

  it('returns null for a malformed token instead of throwing', async () => {
    installFakeAndroidShell((msg) => {
      if (msg.action === 'getContext') return { type: 'utou', appId: APP_ID }
      if (msg.action === 'getIDToken') return 'not-a-jwt'

      return undefined
    })
    mockLookup(registration())

    const pinto = createPintoMiniApp()
    await pinto.init({ appId: APP_ID })

    await expect(pinto.getDecodedIDToken()).resolves.toBeNull()

    pinto.dispose()
  })
})

describe('PintoMiniApp - friendship', () => {
  it('refuses when the Mini App has no associated bot', async () => {
    mockLookup(registration({ bot_id: undefined }))
    const pinto = createPintoMiniApp()
    await pinto.init({ appId: APP_ID, mock: true })

    await expect(pinto.getFriendship()).rejects.toThrow(/no associated bot/)
  })
})

describe('PintoMiniApp - bridge lifecycle', () => {
  it('dispose restores the global callback it installed', async () => {
    const sentinel = () => undefined
    ;(globalThis as Record<string, unknown>).__pinto_callback__ = sentinel

    installFakeAndroidShell((msg) => (msg.action === 'getContext' ? { type: 'utou', appId: APP_ID } : undefined))
    mockLookup(registration())

    const pinto = createPintoMiniApp()
    await pinto.init({ appId: APP_ID })

    expect((globalThis as Record<string, unknown>).__pinto_callback__).not.toBe(sentinel)

    pinto.dispose()

    expect((globalThis as Record<string, unknown>).__pinto_callback__).toBe(sentinel)
  })

  it('times out instead of hanging when the shell never replies', async () => {
    ;(globalThis as Record<string, unknown>).PintoBridge = { postMessage: () => undefined }
    mockLookup(registration({ scopes: ['openid', 'profile', 'scan_qr'] }))

    const pinto = createPintoMiniApp()
    await pinto.init({ appId: APP_ID, bridgeTimeoutMs: 30 })

    await expect(pinto.scanCode()).rejects.toThrow(/timed out/)

    pinto.dispose()
  }, 10_000)
})
