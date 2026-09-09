import { PintoAuthError, PintoOAuthServerError } from './errors.js'
import { computeCodeChallenge, generateCodeVerifier, generateRandomString } from './pkce.js'
import { createDefaultStorage } from './storage.js'
import type {
  AuthorizeUrlOptions,
  PintoAuthConfig,
  PintoSession,
  PintoTokenResponse,
  PintoUser,
  StorageAdapter,
} from './types.js'

export class PintoAuth {
  public readonly config: PintoAuthConfig
  private readonly storage: StorageAdapter
  private readonly prefix: string
  private readonly ssoBaseUrl: string

  constructor(config: PintoAuthConfig) {
    if (!config.clientId) {
      throw new PintoAuthError('clientId is required to initialize PintoAuth')
    }
    if (!config.redirectUri) {
      throw new PintoAuthError('redirectUri is required to initialize PintoAuth')
    }

    this.config = config
    this.storage = config.storage ?? createDefaultStorage()
    this.prefix = config.storageKeyPrefix ?? 'pinto_auth_'
    this.ssoBaseUrl = (config.ssoBaseUrl ?? 'https://api.pinto-app.com').replace(/\/+$/, '')
  }

  /**
   * Build the complete Pinto OAuth Authorization URL with PKCE parameters
   */
  public async buildAuthorizeUrl(options: AuthorizeUrlOptions = {}): Promise<string> {
    const codeVerifier = generateCodeVerifier(64)
    const codeChallenge = await computeCodeChallenge(codeVerifier)
    const state = options.state || generateRandomString(32)

    // Save PKCE verifier and state for callback verification
    await this.storage.setItem(`${this.prefix}verifier_${state}`, codeVerifier)
    await this.storage.setItem(`${this.prefix}state`, state)
    await this.storage.setItem(`${this.prefix}redirect_uri`, this.config.redirectUri)

    const rawScope = options.scope ?? this.config.scope ?? ['openid', 'profile', 'email']
    const scope = Array.isArray(rawScope) ? rawScope.join(' ') : rawScope

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    })

    if (options.resource) {
      params.set('resource', options.resource)
    }
    if (options.prompt) {
      params.set('prompt', options.prompt)
    }

    return `${this.ssoBaseUrl}/oauth/authorize?${params.toString()}`
  }

  /**
   * Initiate OAuth Login by redirecting the user to Pinto SSO
   */
  public async loginWithRedirect(options: AuthorizeUrlOptions = {}): Promise<void> {
    if (typeof window === 'undefined') {
      throw new PintoAuthError('loginWithRedirect can only be called in a browser environment')
    }
    const url = await this.buildAuthorizeUrl(options)
    window.location.href = url
  }

  /**
   * Handle the OAuth redirect callback at the redirect_uri page.
   * Exchanges the authorization code for tokens and retrieves the user profile.
   *
   * @param callbackUrl Optional URL string (defaults to current window.location.href)
   */
  public async handleRedirectCallback(callbackUrl?: string): Promise<PintoSession> {
    let url: URL
    if (callbackUrl) {
      url = new URL(callbackUrl)
    } else if (typeof window !== 'undefined') {
      url = new URL(window.location.href)
    } else {
      throw new PintoAuthError('callbackUrl must be provided when not running in a browser')
    }

    const error = url.searchParams.get('error')
    const errorDescription = url.searchParams.get('error_description') ?? undefined
    if (error) {
      throw new PintoOAuthServerError(error, errorDescription)
    }

    const code = url.searchParams.get('code')
    if (!code) {
      throw new PintoAuthError('No authorization code found in callback URL')
    }

    const state = url.searchParams.get('state')
    if (!state) {
      throw new PintoAuthError('Missing state parameter in callback URL')
    }

    // Retrieve stored verifier for this state
    const verifierKey = `${this.prefix}verifier_${state}`
    const codeVerifier = await this.storage.getItem(verifierKey)
    if (!codeVerifier) {
      throw new PintoAuthError('Invalid or expired state: code_verifier not found. Please initiate login again.')
    }

    // Exchange authorization code for token
    const tokenUrl = `${this.ssoBaseUrl}/oauth/token`
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.config.clientId,
      code,
      redirect_uri: this.config.redirectUri,
      code_verifier: codeVerifier,
    })

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: body.toString(),
    })

    // Clean up one-time PKCE verifier and state
    await this.storage.removeItem(verifierKey)
    await this.storage.removeItem(`${this.prefix}state`)

    if (!response.ok) {
      let errPayload: any = {}
      try {
        errPayload = await response.json()
      } catch {}
      throw new PintoOAuthServerError(
        errPayload.error || 'token_exchange_failed',
        errPayload.error_description || `Failed to exchange token (HTTP ${response.status})`,
        errPayload,
      )
    }

    const tokenResponse: PintoTokenResponse = await response.json()
    const now = Date.now()
    const expiresAt = now + (tokenResponse.expires_in * 1000)

    // Fetch user profile info
    let user: PintoUser | undefined
    try {
      user = await this.fetchUserProfile(tokenResponse.access_token)
    } catch {
      // Userinfo fetch is best-effort; profile can be re-fetched later
    }

    const session: PintoSession = {
      accessToken: tokenResponse.access_token,
      tokenType: tokenResponse.token_type,
      expiresIn: tokenResponse.expires_in,
      expiresAt,
      refreshToken: tokenResponse.refresh_token,
      user,
    }

    // Save session
    await this.storage.setItem(`${this.prefix}session`, JSON.stringify(session))

    return session
  }

  /**
   * Same callback, but the code is redeemed by a backend endpoint instead of by
   * this browser. Pinto SSO's /oauth/token sends no CORS headers, so a page on a
   * developer's own domain cannot call it directly — and a public client has no
   * business holding the exchange anyway.
   *
   * `proxyUrl` must accept `{ code, code_verifier, redirect_uri, client_id }` and
   * answer `{ ok, data: { tokens, user } }` (the portal's POST /api/v1/auth/exchange).
   */
  public async exchangeViaProxy(proxyUrl: string, callbackUrl?: string): Promise<PintoSession> {
    const url = new URL(
      callbackUrl ?? (typeof window !== 'undefined' ? window.location.href : ''),
    )

    const error = url.searchParams.get('error')
    if (error) {
      throw new PintoOAuthServerError(error, url.searchParams.get('error_description') ?? undefined)
    }

    const code = url.searchParams.get('code')
    if (!code) {
      throw new PintoAuthError('No authorization code found in callback URL')
    }

    const state = url.searchParams.get('state')
    if (!state) {
      throw new PintoAuthError('Missing state parameter in callback URL')
    }

    const verifierKey = `${this.prefix}verifier_${state}`
    const codeVerifier = await this.storage.getItem(verifierKey)
    if (!codeVerifier) {
      throw new PintoAuthError('Invalid or expired state: code_verifier not found. Please initiate login again.')
    }

    const res = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        code,
        code_verifier: codeVerifier,
        redirect_uri: this.config.redirectUri,
        client_id: this.config.clientId,
      }),
    })

    await this.storage.removeItem(verifierKey)
    await this.storage.removeItem(`${this.prefix}state`)

    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      data?: {
        tokens: { access_token: string; token_type: string; expires_in?: number; refresh_token?: string }
        user?: Record<string, unknown>
      }
      error?: { message?: string } | string
    }

    if (!res.ok || !body?.ok || !body.data) {
      const message =
        typeof body?.error === 'string' ? body.error : body?.error?.message
      throw new PintoAuthError(message || `Token exchange failed via proxy (HTTP ${res.status})`)
    }

    const { tokens, user } = body.data
    const expiresIn = tokens.expires_in ?? 3600
    const session: PintoSession = {
      accessToken: tokens.access_token,
      tokenType: tokens.token_type,
      expiresIn,
      expiresAt: Date.now() + expiresIn * 1000,
      refreshToken: tokens.refresh_token,
      user: user as unknown as PintoUser | undefined,
    }

    await this.storage.setItem(`${this.prefix}session`, JSON.stringify(session))

    return session
  }

  /**
   * Fetch user profile from Pinto SSO using access token
   */
  public async fetchUserProfile(accessToken: string): Promise<PintoUser> {
    const userinfoUrl = `${this.ssoBaseUrl}/oauth/userinfo`
    const res = await fetch(userinfoUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    })

    if (!res.ok) {
      throw new PintoAuthError(`Failed to fetch user info (HTTP ${res.status})`)
    }

    return await res.json()
  }

  /**
   * Get the current active session
   */
  public async getSession(): Promise<PintoSession | null> {
    const raw = await this.storage.getItem(`${this.prefix}session`)
    if (!raw) return null
    try {
      return JSON.parse(raw) as PintoSession
    } catch {
      return null
    }
  }

  /**
   * Check if a valid session is currently present
   */
  public async isAuthenticated(): Promise<boolean> {
    const session = await this.getSession()
    if (!session || !session.accessToken) return false
    return session.expiresAt > Date.now()
  }

  /**
   * Get current valid access token (or refresh if needed)
   */
  public async getAccessToken(): Promise<string | null> {
    const session = await this.getSession()
    if (!session) return null

    // If still valid (with 60-second leeway)
    if (session.expiresAt - Date.now() > 60000) {
      return session.accessToken
    }

    // If expired but refresh_token exists, try to refresh
    if (session.refreshToken) {
      try {
        const refreshed = await this.refreshSession(session.refreshToken)
        return refreshed.accessToken
      } catch {
        return null
      }
    }

    return null
  }

  /**
   * Refresh session using a refresh token
   */
  public async refreshSession(refreshToken?: string): Promise<PintoSession> {
    const currentSession = await this.getSession()
    const tokenToUse = refreshToken || currentSession?.refreshToken
    if (!tokenToUse) {
      throw new PintoAuthError('No refresh token available')
    }

    const tokenUrl = `${this.ssoBaseUrl}/oauth/token`
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.config.clientId,
      refresh_token: tokenToUse,
    })

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: body.toString(),
    })

    if (!response.ok) {
      await this.logout()
      throw new PintoAuthError(`Failed to refresh token (HTTP ${response.status})`)
    }

    const tokenResponse: PintoTokenResponse = await response.json()
    const now = Date.now()
    const expiresAt = now + (tokenResponse.expires_in * 1000)

    const updatedSession: PintoSession = {
      accessToken: tokenResponse.access_token,
      tokenType: tokenResponse.token_type,
      expiresIn: tokenResponse.expires_in,
      expiresAt,
      refreshToken: tokenResponse.refresh_token || tokenToUse,
      user: currentSession?.user,
    }

    await this.storage.setItem(`${this.prefix}session`, JSON.stringify(updatedSession))
    return updatedSession
  }

  /**
   * Get the current logged-in user profile
   */
  public async getUser(): Promise<PintoUser | null> {
    const session = await this.getSession()
    if (!session) return null
    if (session.user) return session.user

    const token = await this.getAccessToken()
    if (!token) return null

    try {
      const user = await this.fetchUserProfile(token)
      session.user = user
      await this.storage.setItem(`${this.prefix}session`, JSON.stringify(session))
      return user
    } catch {
      return null
    }
  }

  /**
   * Log out and clear stored session
   */
  public async logout(): Promise<void> {
    await this.storage.removeItem(`${this.prefix}session`)
  }
}

/**
 * Factory helper for creating PintoAuth instance
 */
export function createPintoAuth(config: PintoAuthConfig): PintoAuth {
  return new PintoAuth(config)
}
