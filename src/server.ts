import { PintoAuthError, PintoOAuthServerError } from './errors.js'
import { computeCodeChallenge, generateCodeVerifier, generateRandomString } from './pkce.js'
import type { PintoTokenResponse, PintoUser } from './types.js'

export interface PintoServerConfig {
  clientId: string
  clientSecret?: string
  redirectUri: string
  ssoBaseUrl?: string
}

export interface ServerAuthorizeUrlResult {
  url: string
  codeVerifier: string
  codeChallenge: string
  state: string
}

/**
 * Server-side Pinto OAuth Client (for Node.js, Express, Fastify, Next.js API, etc.)
 */
export class PintoServerAuth {
  public readonly clientId: string
  public readonly clientSecret?: string
  public readonly redirectUri: string
  public readonly ssoBaseUrl: string

  constructor(config: PintoServerConfig) {
    if (!config.clientId) throw new PintoAuthError('clientId is required')
    if (!config.redirectUri) throw new PintoAuthError('redirectUri is required')

    this.clientId = config.clientId
    this.clientSecret = config.clientSecret
    this.redirectUri = config.redirectUri
    this.ssoBaseUrl = (config.ssoBaseUrl ?? 'https://api.pinto-app.com').replace(/\/+$/, '')
  }

  /**
   * Generate an Authorize URL along with its codeVerifier and state.
   * Store codeVerifier and state in server session / Redis before redirecting.
   */
  public async createAuthorizeUrl(options: {
    state?: string
    scope?: string | string[]
  } = {}): Promise<ServerAuthorizeUrlResult> {
    const codeVerifier = generateCodeVerifier(64)
    const codeChallenge = await computeCodeChallenge(codeVerifier)
    const state = options.state || generateRandomString(32)

    const rawScope = options.scope ?? ['openid', 'profile', 'email']
    const scope = Array.isArray(rawScope) ? rawScope.join(' ') : rawScope

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    })

    return {
      url: `${this.ssoBaseUrl}/oauth/authorize?${params.toString()}`,
      codeVerifier,
      codeChallenge,
      state,
    }
  }

  /**
   * Exchange the authorization code using the stored codeVerifier
   */
  public async exchangeCode(params: {
    code: string
    codeVerifier: string
    redirectUri?: string
  }): Promise<PintoTokenResponse> {
    const tokenUrl = `${this.ssoBaseUrl}/oauth/token`
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.clientId,
      code: params.code,
      redirect_uri: params.redirectUri || this.redirectUri,
      code_verifier: params.codeVerifier,
    })

    if (this.clientSecret) {
      body.set('client_secret', this.clientSecret)
    }

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: body.toString(),
    })

    if (!response.ok) {
      let errPayload: any = {}
      try {
        errPayload = await response.json()
      } catch {}
      throw new PintoOAuthServerError(
        errPayload.error || 'token_exchange_failed',
        errPayload.error_description || `Token exchange failed (HTTP ${response.status})`,
        errPayload,
      )
    }

    return await response.json()
  }

  /**
   * Fetch user profile using access token
   */
  public async getUserProfile(accessToken: string): Promise<PintoUser> {
    const res = await fetch(`${this.ssoBaseUrl}/oauth/userinfo`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    })
    if (!res.ok) {
      throw new PintoAuthError(`Failed to fetch user profile (HTTP ${res.status})`)
    }
    return await res.json()
  }

  /**
   * Refresh an access token
   */
  public async refreshToken(refreshToken: string): Promise<PintoTokenResponse> {
    const tokenUrl = `${this.ssoBaseUrl}/oauth/token`
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.clientId,
      refresh_token: refreshToken,
    })
    if (this.clientSecret) {
      body.set('client_secret', this.clientSecret)
    }

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: body.toString(),
    })

    if (!response.ok) {
      throw new PintoAuthError(`Failed to refresh token (HTTP ${response.status})`)
    }
    return await response.json()
  }
}
