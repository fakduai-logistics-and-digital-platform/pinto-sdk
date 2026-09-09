/**
 * Type definitions for the Pinto Mini App SDK.
 * See PINTO_MINI_APP_SPEC.md §3.1 and §9.2.
 */

/** Capability scopes a Mini App can be granted in the Developer Portal (spec §2.1). */
export type MiniAppScope =
  | 'profile'
  | 'openid'
  | 'email'
  | 'chat_message.write'
  | 'share_target_picker'
  | 'scan_qr'

export interface MiniAppProfile {
  userId: string
  displayName: string
  pictureUrl?: string
  statusMessage?: string
  email?: string
}

/**
 * Where the Mini App is running.
 * `external` means an outside browser; `none` means init() has not run yet.
 */
export interface MiniAppContext {
  type: 'utou' | 'room' | 'group' | 'external' | 'none'
  chatId?: string
  userId?: string
  appId: string
  viewType?: 'full' | 'tall' | 'compact'
}

export interface MiniAppMessageAction {
  label: string
  uri: string
}

export interface MiniAppMessage {
  type: 'text' | 'card' | 'image'
  text?: string
  title?: string
  description?: string
  mediaUrl?: string
  actions?: MiniAppMessageAction[]
}

export interface ScanCodeResult {
  value: string
  format?: string
}

export interface FriendshipResult {
  friendFlag: boolean
}

export type HapticFeedbackType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error'

export type MiniAppOS = 'ios' | 'android' | 'web'

/** Outbound message to the native shell (spec §4.1). */
export interface BridgeMessage {
  callbackId: string
  action: string
  params: Record<string, unknown>
}

/** Inbound reply from the native shell (spec §4.2). */
export interface BridgeResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string | null
}

export interface MiniAppInitOptions {
  appId: string
  /**
   * Developer Portal API base. The SDK calls `/api/v1/mini-apps/lookup/:app_id`
   * during init to resolve the registration and its granted scopes.
   */
  apiBaseUrl?: string
  /**
   * Pinto SSO base used by the external-browser login path. Defaults to production;
   * point it at the dev SSO when the app_id was issued there.
   */
  ssoBaseUrl?: string
  /**
   * Redeem the authorization code through the portal's `POST /api/v1/auth/exchange`
   * instead of calling Pinto SSO's token endpoint from the page. Required in an
   * external browser: `/oauth/token` sends no CORS headers.
   */
  exchangeViaBackend?: boolean
  /** Force the mock bridge on, regardless of environment detection. */
  mock?: boolean
  /** Profile returned by the mock bridge while developing on a desktop browser. */
  mockProfile?: MiniAppProfile
  /** Context returned by the mock bridge. Defaults to an `external` context. */
  mockContext?: Partial<MiniAppContext>
  /** How long to wait for the native shell before rejecting a bridge call, in ms. */
  bridgeTimeoutMs?: number
}

/** Mini App registration as returned by the Developer Portal lookup endpoint. */
export interface MiniAppRegistration {
  app_id: string
  name: string
  description?: string
  icon_url?: string
  endpoint_url: string
  developing_url?: string
  bot_id?: string
  scopes: MiniAppScope[]
  allowed_domains: string[]
  is_active: boolean
}

export interface LoginOptions {
  redirectUri?: string
  scope?: string | string[]
}
