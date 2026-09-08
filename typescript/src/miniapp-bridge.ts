import type {
  BridgeMessage,
  BridgeResponse,
  MiniAppContext,
  MiniAppProfile,
  ScanCodeResult,
} from './miniapp-types.js'

/**
 * Transport between the Mini App and the Pinto native shell (spec §4).
 *
 * Kept separate from PintoMiniApp so the class stays about the developer-facing
 * API while the postMessage / callback plumbing — and its mock twin — lives in
 * one place that can be swapped wholesale when testing.
 */

const CALLBACK_REGISTRY = '__pinto_callback__'
const DEFAULT_TIMEOUT_MS = 15_000

interface PendingCall {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
  timer: ReturnType<typeof setTimeout>
}

interface IosBridgeHost {
  webkit?: {
    messageHandlers?: {
      pintoBridge?: { postMessage: (payload: unknown) => void }
    }
  }
}

interface AndroidBridgeHost {
  PintoBridge?: { postMessage: (payload: string) => void }
}

type BridgeHost = IosBridgeHost & AndroidBridgeHost & Record<string, unknown>

function host(): BridgeHost | undefined {
  return typeof window === 'undefined' ? undefined : (window as unknown as BridgeHost)
}

export function detectNativeBridge(): 'ios' | 'android' | null {
  const w = host()
  if (!w) return null
  if (w.webkit?.messageHandlers?.pintoBridge) return 'ios'
  if (typeof w.PintoBridge?.postMessage === 'function') return 'android'

  return null
}

export interface Bridge {
  /** Which transport this is — not whether a shell is currently reachable. */
  readonly kind: 'native' | 'mock'
  /** True only when a native shell is actually present right now. */
  readonly isNative: boolean
  call<T>(action: string, params?: Record<string, unknown>): Promise<T>
  dispose(): void
}

/** Talks to the real iOS/Android shell. */
export class NativeBridge implements Bridge {
  readonly kind = 'native' as const

  /**
   * Computed, not hardcoded: a NativeBridge is also what gets built for a
   * published Mini App opened in an ordinary browser, where no shell exists.
   * Reporting `true` there would make isInClient() claim the app is running
   * inside Pinto and send native-only calls into a void.
   */
  get isNative(): boolean {
    return detectNativeBridge() !== null
  }

  private pending = new Map<string, PendingCall>()
  private sequence = 0
  private previousCallback: unknown
  private installed = false

  constructor(private readonly timeoutMs: number = DEFAULT_TIMEOUT_MS) {
    this.install()
  }

  /**
   * The shell calls a single global to reply (spec §4.2). Any previously
   * installed handler is kept and restored on dispose so two SDK instances on
   * one page cannot silently break each other.
   */
  private install(): void {
    const w = host()
    if (!w || this.installed) return

    this.previousCallback = w[CALLBACK_REGISTRY]
    w[CALLBACK_REGISTRY] = (callbackId: string, response: BridgeResponse) => {
      this.settle(callbackId, response)
    }
    this.installed = true
  }

  private settle(callbackId: string, response: BridgeResponse): void {
    const call = this.pending.get(callbackId)
    if (!call) return

    clearTimeout(call.timer)
    this.pending.delete(callbackId)

    if (response && response.success) call.resolve(response.data)
    else call.reject(new Error(response?.error || `Pinto bridge call failed: ${callbackId}`))
  }

  call<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
    const w = host()
    const target = detectNativeBridge()
    if (!w || !target) {
      return Promise.reject(new Error('Pinto native bridge is not available'))
    }

    const callbackId = `req_${Date.now()}_${++this.sequence}`
    const message: BridgeMessage = { callbackId, action, params }

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(callbackId)
        reject(new Error(`Pinto bridge call timed out after ${this.timeoutMs}ms: ${action}`))
      }, this.timeoutMs)

      this.pending.set(callbackId, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timer,
      })

      try {
        if (target === 'ios') w.webkit!.messageHandlers!.pintoBridge!.postMessage(message)
        else w.PintoBridge!.postMessage(JSON.stringify(message))
      } catch (err) {
        clearTimeout(timer)
        this.pending.delete(callbackId)
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    })
  }

  dispose(): void {
    for (const [, call] of this.pending) {
      clearTimeout(call.timer)
      call.reject(new Error('Pinto bridge disposed'))
    }
    this.pending.clear()

    const w = host()
    if (w && this.installed) {
      if (this.previousCallback === undefined) delete w[CALLBACK_REGISTRY]
      else w[CALLBACK_REGISTRY] = this.previousCallback
      this.installed = false
    }
  }
}

export interface MockBridgeOptions {
  profile?: MiniAppProfile
  context?: Partial<MiniAppContext>
  appId: string
}

const DEFAULT_MOCK_PROFILE: MiniAppProfile = {
  userId: 'U_mock_0000000000000000',
  displayName: 'Mock Pinto User',
  pictureUrl: 'https://static.pinto-app.com/mock/avatar.png',
  statusMessage: 'Running in Mini App mock mode',
  email: 'mock.user@example.com',
}

/**
 * Stand-in shell for desktop development (spec §4.3).
 *
 * Every action resolves with a plausible payload and logs what a real device
 * would have done, so a developer can build the whole flow before the app is
 * ever installed. It deliberately does NOT emulate failures — mock mode is for
 * building the happy path, not for testing error handling.
 */
export class MockBridge implements Bridge {
  readonly kind = 'mock' as const
  readonly isNative = false

  constructor(private readonly options: MockBridgeOptions) {}

  async call<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
    const result = this.respond(action, params)
    // Keep the async shape so mock and native code paths behave identically.
    return Promise.resolve(result as T)
  }

  private respond(action: string, params: Record<string, unknown>): unknown {
    switch (action) {
      case 'getProfile':
        return this.options.profile || DEFAULT_MOCK_PROFILE

      case 'getContext':
        return {
          type: 'external',
          appId: this.options.appId,
          ...this.options.context,
        } satisfies MiniAppContext

      case 'getIDToken':
        return null

      case 'scanCode':
        return { value: 'https://pinto-app.com/mock/scan', format: 'QR_CODE' } satisfies ScanCodeResult

      case 'getFriendship':
        return { friendFlag: true }

      case 'sendMessages':
      case 'shareTargetPicker':
      case 'openWindow':
      case 'closeWindow':
      case 'createShortcut':
      case 'hapticFeedback':
        this.log(action, params)
        return undefined

      case 'copyText':
        this.log(action, params)
        return true

      default:
        throw new Error(`Pinto mock bridge has no handler for action: ${action}`)
    }
  }

  private log(action: string, params: Record<string, unknown>): void {
    if (typeof console !== 'undefined') {
      console.info(`[pinto:mock] ${action}`, params)
    }
  }

  dispose(): void {
    // Nothing to tear down — the mock holds no globals or timers.
  }
}
