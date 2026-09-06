import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PintoAuth } from '../auth.js'
import { MemoryStorageAdapter } from '../storage.js'

describe('PintoAuth', () => {
  let auth: PintoAuth
  let storage: MemoryStorageAdapter

  beforeEach(() => {
    storage = new MemoryStorageAdapter()
    auth = new PintoAuth({
      clientId: 'pinto-app_test123',
      redirectUri: 'https://myapp.com/auth/callback',
      ssoBaseUrl: 'https://api-dev.pinto-app.com',
      storage,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('validates required configuration', () => {
    expect(() => new PintoAuth({ clientId: '', redirectUri: 'http://localhost' }))
      .toThrow('clientId is required')
    expect(() => new PintoAuth({ clientId: 'id', redirectUri: '' }))
      .toThrow('redirectUri is required')
  })

  it('builds a valid authorization URL containing all required PKCE parameters', async () => {
    const urlStr = await auth.buildAuthorizeUrl({
      state: 'custom-state-123',
    })

    const url = new URL(urlStr)
    expect(url.origin).toBe('https://api-dev.pinto-app.com')
    expect(url.pathname).toBe('/oauth/authorize')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('client_id')).toBe('pinto-app_test123')
    expect(url.searchParams.get('redirect_uri')).toBe('https://myapp.com/auth/callback')
    expect(url.searchParams.get('scope')).toBe('openid profile email')
    expect(url.searchParams.get('state')).toBe('custom-state-123')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('code_challenge')).toBeTruthy()

    // Verifier should be saved in storage
    const verifier = storage.getItem('pinto_auth_verifier_custom-state-123')
    expect(verifier).toBeTruthy()
    expect(verifier?.length).toBeGreaterThanOrEqual(43)
  })

  it('handles redirect callback and exchanges authorization code for token', async () => {
    const state = 'test-state-456'
    // Pre-save verifier as would happen during buildAuthorizeUrl
    storage.setItem(`pinto_auth_verifier_${state}`, 'test-code-verifier-string-12345678901234567890')
    storage.setItem('pinto_auth_state', state)

    // Mock fetch for token exchange and userinfo
    const mockTokenResponse = {
      access_token: 'mock-access-token-xyz',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: 'mock-refresh-token-xyz',
    }
    const mockUserResponse = {
      sub: 'user_123',
      name: 'Watchakorn',
      email: 'watchakorn@pinto-app.com',
    }

    global.fetch = vi.fn().mockImplementation(async (input: string) => {
      if (input.includes('/oauth/token')) {
        return {
          ok: true,
          json: async () => mockTokenResponse,
        }
      }
      if (input.includes('/oauth/userinfo')) {
        return {
          ok: true,
          json: async () => mockUserResponse,
        }
      }
      return { ok: false, status: 404 }
    }) as any

    const callbackUrl = `https://myapp.com/auth/callback?code=mock-auth-code&state=${state}`
    const session = await auth.handleRedirectCallback(callbackUrl)

    expect(session.accessToken).toBe('mock-access-token-xyz')
    expect(session.user?.name).toBe('Watchakorn')
    expect(session.user?.email).toBe('watchakorn@pinto-app.com')

    // Verifier should be cleaned up
    expect(storage.getItem(`pinto_auth_verifier_${state}`)).toBeNull()

    // Session should be persisted
    const savedSession = await auth.getSession()
    expect(savedSession?.accessToken).toBe('mock-access-token-xyz')
    expect(await auth.isAuthenticated()).toBe(true)
    expect(await auth.getAccessToken()).toBe('mock-access-token-xyz')
  })

  it('throws PintoOAuthServerError if OAuth error param is returned', async () => {
    const callbackUrl = 'https://myapp.com/auth/callback?error=access_denied&error_description=User+cancelled'
    await expect(auth.handleRedirectCallback(callbackUrl))
      .rejects.toThrow('access_denied: User cancelled')
  })

  it('clears session on logout', async () => {
    storage.setItem('pinto_auth_session', JSON.stringify({
      accessToken: 'token',
      expiresAt: Date.now() + 100000,
    }))

    expect(await auth.isAuthenticated()).toBe(true)
    await auth.logout()
    expect(await auth.isAuthenticated()).toBe(false)
  })
})
