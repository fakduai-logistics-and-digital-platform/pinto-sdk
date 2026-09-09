import { PintoAuth } from './auth.js'
import { PintoAuthError } from './errors.js'
import type { Bridge } from './miniapp-bridge.js'
import { MockBridge, NativeBridge, detectNativeBridge } from './miniapp-bridge.js'
import type {
  FriendshipResult,
  HapticFeedbackType,
  LoginOptions,
  MiniAppContext,
  MiniAppInitOptions,
  MiniAppMessage,
  MiniAppOS,
  MiniAppProfile,
  MiniAppRegistration,
  MiniAppScope,
  ScanCodeResult,
} from './miniapp-types.js'

const DEFAULT_API_BASE_URL = 'https://developers.pinto-app.com'
const DEFAULT_SSO_BASE_URL = 'https://api.pinto-app.com'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '0.0.0.0'])

/**
 * Auto-mock is scoped to development hosts on purpose. Enabling it merely because
 * no native bridge was found would hand fake profiles to real users the moment a
 * published Mini App is opened in an ordinary browser, which is exactly the case
 * that must fall through to real OAuth instead.
 */
function isLocalDevHost(): boolean {
  if (typeof window === 'undefined') return false

  const hostname = window.location?.hostname
  if (!hostname) return false

  return LOCAL_HOSTS.has(hostname) || hostname.endsWith('.localhost')
}

/**
 * Pinto Mini App client (spec §3).
 *
 * One object covers both places a Mini App runs: inside the Pinto client, where
 * the native shell answers over the JSBridge and the user is already signed in,
 * and an external browser, where the same calls fall back to OAuth via PintoAuth
 * or are refused because they need hardware the browser cannot reach.
 */
export class PintoMiniApp {
  private options: MiniAppInitOptions | null = null
  private bridge: Bridge | null = null
  private registration: MiniAppRegistration | null = null
  private auth: PintoAuth | null = null
  private context: MiniAppContext = { type: 'none', appId: '' }
  private initialized = false

  /**
   * Resolve the registration, pick a transport, and hand back a ready client.
   *
   * The lookup is not optional: it is what proves the app_id is real and active,
   * and it carries the granted scopes every capability check below relies on.
   */
  async init(options: MiniAppInitOptions): Promise<void> {
    if (!options?.appId) {
      throw new PintoAuthError('appId is required to initialize the Pinto Mini App SDK')
    }

    this.options = options
    this.registration = await this.fetchRegistration(options)

    const useMock = options.mock ?? (detectNativeBridge() === null && isLocalDevHost())

    this.bridge?.dispose()
    this.bridge = useMock
      ? new MockBridge({
          appId: options.appId,
          profile: options.mockProfile,
          context: options.mockContext,
        })
      : new NativeBridge(options.bridgeTimeoutMs)

    this.context = await this.loadContext()
    this.initialized = true
  }

  private async fetchRegistration(options: MiniAppInitOptions): Promise<MiniAppRegistration> {
    const base = (options.apiBaseUrl || DEFAULT_API_BASE_URL).replace(/\/+$/, '')
    const url = `${base}/api/v1/mini-apps/lookup/${encodeURIComponent(options.appId)}`

    let res: Response
    try {
      res = await fetch(url)
    } catch (err) {
      throw new PintoAuthError(
        `Could not reach the Pinto Developer Portal at ${base}: ${err instanceof Error ? err.message : String(err)}`
      )
    }

    if (!res.ok) {
      throw new PintoAuthError(
        `Mini App '${options.appId}' could not be resolved (${res.status}). Check the App ID and that the app is active.`
      )
    }

    const body = (await res.json()) as { ok?: boolean; data?: MiniAppRegistration; error?: string }
    if (!body?.ok || !body.data) {
      throw new PintoAuthError(body?.error || `Mini App '${options.appId}' could not be resolved`)
    }

    return body.data
  }

  private async loadContext(): Promise<MiniAppContext> {
    const appId = this.options!.appId
    try {
      const ctx = await this.bridge!.call<MiniAppContext>('getContext')

      return { ...ctx, appId }
    } catch {
      // An external browser has no chat context; that is a normal state, not a failure.
      return { type: 'external', appId }
    }
  }

  private assertReady(): void {
    if (!this.initialized || !this.bridge || !this.options) {
      throw new PintoAuthError('Call pinto.init({ appId }) before using the Pinto Mini App SDK')
    }
  }

  /**
   * Fail before the bridge call when the scope was never granted. The portal and
   * the shell both enforce this too — this check exists so the developer sees a
   * named scope during development instead of an opaque native rejection.
   */
  private assertScope(scope: MiniAppScope, method: string): void {
    this.assertReady()
    if (!this.registration?.scopes.includes(scope)) {
      throw new PintoAuthError(
        `pinto.${method}() needs the '${scope}' scope. Grant it in the Pinto Developer Portal under Mini App > Scopes.`
      )
    }
  }

  private assertInClient(method: string): void {
    if (!this.isInClient()) {
      throw new PintoAuthError(
        `pinto.${method}() only works inside the Pinto app. Guard it with pinto.isInClient().`
      )
    }
  }

  // --- Lifecycle & environment (spec §3.2.1) ---

  /** True inside the Pinto client, false in an external browser or mock mode. */
  isInClient(): boolean {
    return this.bridge?.isNative === true
  }

  /** True when the mock bridge is standing in for the native shell (spec §4.3). */
  isMock(): boolean {
    return this.bridge?.kind === 'mock'
  }

  /**
   * Whether a bridge — real or mocked — can answer identity calls. The point of
   * mock mode is developing the whole flow without a device, so it must not fall
   * through to a real OAuth redirect. A published app in an ordinary browser has
   * neither, and correctly drops through to OAuth.
   */
  private get bridgeAnswersIdentity(): boolean {
    return this.isInClient() || this.isMock()
  }

  getOS(): MiniAppOS {
    if (typeof navigator === 'undefined') return 'web'

    const ua = navigator.userAgent || ''
    if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
    if (/Android/i.test(ua)) return 'android'

    return 'web'
  }

  getContext(): MiniAppContext {
    this.assertReady()

    return this.context
  }

  /** The resolved registration, useful for rendering the app name or icon. */
  getRegistration(): MiniAppRegistration | null {
    return this.registration
  }

  /** Scopes actually granted to this Mini App. */
  getGrantedScopes(): MiniAppScope[] {
    return this.registration ? [...this.registration.scopes] : []
  }

  // --- Authentication & identity (spec §3.2.2) ---

  /**
   * Inside the client the shell owns the session, so this is always true.
   * Outside it, it reflects whether an OAuth session is stored.
   */
  isLoggedIn(): boolean {
    if (this.bridgeAnswersIdentity) return true

    return this.cachedLoggedIn
  }

  private cachedLoggedIn = false

  /** Async truth for the external-browser case, where storage may be a promise. */
  async checkLoggedIn(): Promise<boolean> {
    if (this.bridgeAnswersIdentity) return true

    this.cachedLoggedIn = await this.getAuth().isAuthenticated()

    return this.cachedLoggedIn
  }

  async login(options: LoginOptions = {}): Promise<void> {
    this.assertReady()
    if (this.bridgeAnswersIdentity) return

    await this.getAuth().loginWithRedirect({
      scope: options.scope ?? this.getGrantedScopes(),
    })
  }

  /**
   * Finish the external-browser login. Call it on every page load: it is a no-op
   * unless the URL carries the `?code=&state=` the SSO redirect brought back.
   * Returns true when a session was established by this call.
   */
  async handleLoginCallback(): Promise<boolean> {
    this.assertReady()
    if (this.bridgeAnswersIdentity || typeof window === 'undefined') return false

    const params = new URLSearchParams(window.location.search)
    if (!params.get('code') || !params.get('state')) return false

    if (this.options!.exchangeViaBackend) {
      const base = (this.options!.apiBaseUrl || DEFAULT_API_BASE_URL).replace(/\/+$/, '')
      await this.getAuth().exchangeViaProxy(`${base}/api/v1/auth/exchange`)
    } else {
      await this.getAuth().handleRedirectCallback()
    }
    this.cachedLoggedIn = true

    // Drop the one-time code from the address bar so a reload cannot replay it.
    const clean = `${window.location.origin}${window.location.pathname}${window.location.hash}`
    window.history.replaceState({}, '', clean)

    return true
  }

  async logout(): Promise<void> {
    if (this.bridgeAnswersIdentity) return

    await this.getAuth().logout()
    this.cachedLoggedIn = false
  }

  async getProfile(): Promise<MiniAppProfile> {
    this.assertScope('profile', 'getProfile')

    if (this.bridgeAnswersIdentity) {
      return this.bridge!.call<MiniAppProfile>('getProfile')
    }

    const user = await this.getAuth().getUser()
    if (!user) {
      throw new PintoAuthError('No Pinto session. Call pinto.login() first when running outside the Pinto app.')
    }

    const u = user as typeof user & { display_name?: string; username?: string }

    return {
      userId: String(user.id ?? user.sub),
      // The proxy exchange returns the portal's shape, which names it display_name.
      displayName: user.name ?? u.display_name ?? u.username ?? '',
      pictureUrl: user.picture,
      email: user.email,
    }
  }

  async getIDToken(): Promise<string | null> {
    this.assertScope('openid', 'getIDToken')

    if (this.bridgeAnswersIdentity) {
      return this.bridge!.call<string | null>('getIDToken')
    }

    const session = await this.getAuth().getSession()

    return (session as { idToken?: string } | null)?.idToken ?? null
  }

  /**
   * Decode the ID Token payload for its claims. Decoding is not verification —
   * anything the app trusts must be re-checked server side (spec §9.3).
   */
  async getDecodedIDToken(): Promise<Record<string, unknown> | null> {
    const token = await this.getIDToken()
    if (!token) return null

    const payload = token.split('.')[1]
    if (!payload) return null

    try {
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
      const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=')

      // Decode through bytes so non-ASCII claims (a Thai display name) survive;
      // atob alone yields latin-1 and would mangle them.
      const bytes = Uint8Array.from(atob(padded), (ch) => ch.charCodeAt(0))

      return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>
    } catch {
      return null
    }
  }

  // --- Chat interaction (spec §3.2.3) ---

  async sendMessages(messages: MiniAppMessage[]): Promise<void> {
    this.assertScope('chat_message.write', 'sendMessages')
    this.assertInClient('sendMessages')

    if (!Array.isArray(messages) || messages.length === 0) {
      throw new PintoAuthError('sendMessages() requires at least one message')
    }

    await this.bridge!.call<void>('sendMessages', { messages })
  }

  async shareTargetPicker(messages: MiniAppMessage[]): Promise<void> {
    this.assertScope('share_target_picker', 'shareTargetPicker')
    this.assertInClient('shareTargetPicker')

    if (!Array.isArray(messages) || messages.length === 0) {
      throw new PintoAuthError('shareTargetPicker() requires at least one message')
    }

    await this.bridge!.call<void>('shareTargetPicker', { messages })
  }

  // --- Device & window control (spec §3.2.4) ---

  async scanCode(): Promise<ScanCodeResult> {
    this.assertScope('scan_qr', 'scanCode')
    this.assertInClient('scanCode')

    return this.bridge!.call<ScanCodeResult>('scanCode')
  }

  /**
   * Opens a URL. Outside the client there is no shell to ask, so this falls back
   * to window.open rather than failing on something the browser can do natively.
   */
  async openWindow(options: { url: string; external?: boolean }): Promise<void> {
    this.assertReady()
    if (!options?.url) throw new PintoAuthError('openWindow() requires a url')

    if (!this.isInClient()) {
      if (typeof window !== 'undefined') window.open(options.url, options.external ? '_blank' : '_self')
      return
    }

    await this.bridge!.call<void>('openWindow', {
      url: options.url,
      external: options.external === true,
    })
  }

  async closeWindow(): Promise<void> {
    this.assertReady()
    if (!this.isInClient()) return

    await this.bridge!.call<void>('closeWindow')
  }

  async createShortcut(options: { title?: string; iconUrl?: string } = {}): Promise<void> {
    this.assertReady()
    this.assertInClient('createShortcut')

    await this.bridge!.call<void>('createShortcut', {
      title: options.title ?? this.registration?.name,
      iconUrl: options.iconUrl ?? this.registration?.icon_url,
    })
  }

  /** Best-effort haptic tap. Silently ignored outside the client. */
  hapticFeedback(type: HapticFeedbackType = 'light'): void {
    if (!this.isInClient()) return

    void this.bridge!.call<void>('hapticFeedback', { type }).catch(() => undefined)
  }

  async copyText(text: string): Promise<boolean> {
    this.assertReady()

    if (this.isInClient() || this.isMock()) {
      return this.bridge!.call<boolean>('copyText', { text })
    }

    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      return false
    }
  }

  // --- Bot friendship (spec §3.2.5) ---

  /**
   * Whether the user follows the bot linked to this Mini App. Answered by the
   * shell in-client, and by the Developer Portal API outside it.
   */
  async getFriendship(): Promise<FriendshipResult> {
    this.assertReady()

    const botId = this.registration?.bot_id
    if (!botId) {
      throw new PintoAuthError('This Mini App has no associated bot, so friendship cannot be checked')
    }

    if (this.bridgeAnswersIdentity) {
      return this.bridge!.call<FriendshipResult>('getFriendship', { botId })
    }

    const base = (this.options!.apiBaseUrl || DEFAULT_API_BASE_URL).replace(/\/+$/, '')
    const token = await this.getAuth().getAccessToken()
    if (!token) {
      throw new PintoAuthError('No Pinto session. Call pinto.login() before checking friendship.')
    }

    const res = await fetch(`${base}/api/v1/mini-apps/friendship/${encodeURIComponent(botId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      throw new PintoAuthError(`Friendship check failed (${res.status})`)
    }

    const body = (await res.json()) as { data?: { friend_flag?: boolean } }

    return { friendFlag: Boolean(body?.data?.friend_flag) }
  }

  // --- Internals ---

  /**
   * PintoAuth is only needed in the external-browser path, so it is built lazily
   * — an in-client Mini App never pays for OAuth plumbing it will not use.
   */
  private getAuth(): PintoAuth {
    this.assertReady()

    if (!this.auth) {
      this.auth = new PintoAuth({
        clientId: this.options!.appId,
        // origin + pathname, never href: the same value is replayed as `redirect_uri`
        // at token exchange, and on the way back the URL carries ?code=&state=.
        redirectUri:
          typeof window === 'undefined'
            ? ''
            : `${window.location.origin}${window.location.pathname}`,
        ssoBaseUrl: this.options!.ssoBaseUrl || DEFAULT_SSO_BASE_URL,
        scope: this.getGrantedScopes(),
      })
    }

    return this.auth
  }

  /** Release the bridge globals. Mostly for tests and hot-reload. */
  dispose(): void {
    this.bridge?.dispose()
    this.bridge = null
    this.initialized = false
  }
}

/** Shared instance, matching the `pinto.*` style used throughout the docs. */
export const pintoMiniApp = new PintoMiniApp()

export function createPintoMiniApp(): PintoMiniApp {
  return new PintoMiniApp()
}
