// Client / Browser Authentication
export { PintoAuth, createPintoAuth, PintoAuth as PintoClient } from './auth.js'

// Pinto Login Button & UI
export {
  createPintoButton,
  getPintoButtonHtml,
  renderPintoButton,
} from './button.js'
export type {
  PintoButtonOptions,
  PintoButtonShape,
  PintoButtonSize,
  PintoButtonTheme,
} from './button.js'

// Assets
export { PINTO_LOGO_DATA_URL } from './assets/logo.js'

// Server / Backend Authentication
export { PintoServerAuth } from './server.js'
export type { PintoServerConfig, ServerAuthorizeUrlResult } from './server.js'

// Bot & Webhook Utilities
export {
  createReplyResponse,
  parseWebhookEvent,
  verifyWebhookSecret,
} from './webhook.js'
export type {
  WebhookBaseEvent,
  WebhookEvent,
  WebhookMessageEvent,
  WebhookPingEvent,
  WebhookReplyPayload,
} from './webhook.js'

// Errors
export { PintoAuthError, PintoOAuthServerError } from './errors.js'

// PKCE Utilities
export {
  base64UrlEncode,
  computeCodeChallenge,
  generateCodeVerifier,
  generateRandomString,
} from './pkce.js'

// Storage Adapters
export {
  LocalStorageAdapter,
  MemoryStorageAdapter,
  SessionStorageAdapter,
  createDefaultStorage,
} from './storage.js'

// Common Types
export type {
  AuthorizeUrlOptions,
  PintoAuthConfig,
  PintoSession,
  PintoTokenResponse,
  PintoUser,
  StorageAdapter,
} from './types.js'
