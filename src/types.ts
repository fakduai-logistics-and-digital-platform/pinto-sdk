/**
 * Configuration options for initializing PintoAuth
 */
export interface PintoAuthConfig {
  /**
   * The Client ID assigned by Pinto Developer Portal (e.g. 'pinto-app_xyz123')
   */
  clientId: string

  /**
   * The registered redirect URI where Pinto will return with authorization code
   * (Must match one of the Redirect URIs configured in the Developer Portal)
   */
  redirectUri: string

  /**
   * The Pinto SSO API Base URL
   * @default 'https://api.pinto-app.com'
   */
  ssoBaseUrl?: string

  /**
   * Pinto Main Frontend Login URL (for web login redirect)
   * @default 'https://pinto-app.com'
   */
  mainLoginUrl?: string

  /**
   * Default OAuth Scopes to request
   * @default ['openid', 'profile', 'email']
   */
  scope?: string | string[]

  /**
   * Custom storage adapter for persisting session and PKCE state
   * @default Browser sessionStorage with fallback to in-memory
   */
  storage?: StorageAdapter

  /**
   * Storage key prefix
   * @default 'pinto_auth_'
   */
  storageKeyPrefix?: string
}

/**
 * Options when generating the authorization URL
 */
export interface AuthorizeUrlOptions {
  /**
   * Custom state string (if not provided, a secure random 32-char state will be generated)
   */
  state?: string

  /**
   * Override default scopes for this authorization request
   */
  scope?: string | string[]

  /**
   * Optional resource server indicator (RFC 8707)
   */
  resource?: string

  /**
   * Prompt behavior: 'consent' | 'login' | 'none'
   */
  prompt?: string
}

/**
 * Raw token response from Pinto OAuth Token endpoint
 */
export interface PintoTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
  scope?: string
  id_token?: string
}

/**
 * User Profile info from Pinto SSO
 */
export interface PintoUser {
  sub: string
  id?: string
  name?: string
  email?: string
  picture?: string
  [key: string]: unknown
}

/**
 * Stored session state
 */
export interface PintoSession {
  accessToken: string
  tokenType: string
  expiresIn: number
  expiresAt: number
  refreshToken?: string
  user?: PintoUser
}

/**
 * Storage adapter interface for state and session persistence
 */
export interface StorageAdapter {
  getItem(key: string): string | null | Promise<string | null>
  setItem(key: string, value: string): void | Promise<void>
  removeItem(key: string): void | Promise<void>
}
