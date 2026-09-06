import { describe, expect, it, vi } from 'vitest'
import { PintoServerAuth } from '../server.js'

describe('PintoServerAuth', () => {
  const serverAuth = new PintoServerAuth({
    clientId: 'pinto-app_backend123',
    clientSecret: 'secret456',
    redirectUri: 'http://localhost:8080/auth/callback',
    ssoBaseUrl: 'https://api-dev.pinto-app.com',
  })

  it('creates authorization url and returns verifier to store', async () => {
    const res = await serverAuth.createAuthorizeUrl({ state: 's1' })
    expect(res.url).toContain('client_id=pinto-app_backend123')
    expect(res.url).toContain('code_challenge=')
    expect(res.url).toContain('code_challenge_method=S256')
    expect(res.codeVerifier).toBeTruthy()
    expect(res.state).toBe('s1')
  })

  it('exchanges code for tokens using verifier', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'server_access_token',
        token_type: 'Bearer',
        expires_in: 3600,
      }),
    }) as any

    const token = await serverAuth.exchangeCode({
      code: 'auth_code_123',
      codeVerifier: 'verifier_string',
    })

    expect(token.access_token).toBe('server_access_token')
  })
})
