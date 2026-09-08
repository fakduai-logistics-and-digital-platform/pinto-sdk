/**
 * Universal crypto provider supporting both Web Crypto API (Browser) and Node.js 18+
 */
function getCrypto(): Crypto {
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    return globalThis.crypto
  }
  throw new Error('Web Cryptography API is not available in this environment')
}

/**
 * Generate a cryptographically random string using unreserved characters
 * @param length Length of the string (defaults to 32)
 */
export function generateRandomString(length = 32): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  const crypto = getCrypto()
  const values = new Uint8Array(length)
  crypto.getRandomValues(values)

  let result = ''
  for (let i = 0; i < length; i++) {
    result += charset[values[i] % charset.length]
  }
  return result
}

/**
 * Generate a standard PKCE code_verifier (RFC 7636)
 * @param length Length between 43 and 128 characters (default 64)
 */
export function generateCodeVerifier(length = 64): string {
  const validLength = Math.max(43, Math.min(128, length))
  return generateRandomString(validLength)
}

interface NodeBufferCtor {
  from(data: Uint8Array | string, encoding?: string): { toString(encoding: string): string }
}

/**
 * Node's Buffer, when running outside a browser. Reached via globalThis because
 * this package targets the DOM lib only — naming the bare `Buffer` global would
 * require @types/node, which would leak Node globals into every consumer's build.
 */
const nodeBuffer = (globalThis as { Buffer?: NodeBufferCtor }).Buffer

/**
 * Convert an ArrayBuffer or Uint8Array to Base64URL string without padding
 */
export function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }

  // Use btoa if available in global scope
  let base64 = ''
  if (typeof btoa === 'function') {
    base64 = btoa(binary)
  } else if (nodeBuffer) {
    base64 = nodeBuffer.from(bytes).toString('base64')
  } else {
    throw new Error('No base64 encoding implementation available')
  }

  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * Calculate SHA-256 Code Challenge from Code Verifier (RFC 7636 S256 method)
 * @param verifier The code_verifier string
 */
export async function computeCodeChallenge(verifier: string): Promise<string> {
  const crypto = getCrypto()
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return base64UrlEncode(digest)
}
