import { describe, expect, it } from 'vitest'
import {
  computeCodeChallenge,
  generateCodeVerifier,
  generateRandomString,
} from '../pkce.js'

describe('PKCE Utilities', () => {
  it('generates random string of specified length', () => {
    const s1 = generateRandomString(16)
    const s2 = generateRandomString(32)
    expect(s1).toHaveLength(16)
    expect(s2).toHaveLength(32)
    expect(s1).not.toBe(s2)
  })

  it('clamps code_verifier length between 43 and 128 characters', () => {
    const tooShort = generateCodeVerifier(10)
    const normal = generateCodeVerifier(64)
    const tooLong = generateCodeVerifier(200)

    expect(tooShort).toHaveLength(43)
    expect(normal).toHaveLength(64)
    expect(tooLong).toHaveLength(128)
  })

  it('computes S256 code_challenge correctly against RFC 7636 standard test vector', async () => {
    // Official test vector from RFC 7636 Appendix B
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
    const expectedChallenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'

    const challenge = await computeCodeChallenge(verifier)
    expect(challenge).toBe(expectedChallenge)
  })
})
