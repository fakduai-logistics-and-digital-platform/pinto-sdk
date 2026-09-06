/**
 * Incoming Webhook Event from Pinto Bot Platform
 */
export interface WebhookBaseEvent {
  event: 'ping' | 'message.created' | string
  timestamp: string
}

export interface WebhookPingEvent extends WebhookBaseEvent {
  event: 'ping'
  message: string
}

export interface WebhookMessageEvent extends WebhookBaseEvent {
  event: 'message.created'
  bot_id: string
  chat_id: string
  message_id: string
  sender: {
    user_id: string
    name: string
  }
  message: string
}

export type WebhookEvent = WebhookPingEvent | WebhookMessageEvent | (WebhookBaseEvent & Record<string, unknown>)

export interface WebhookReplyPayload {
  reply_message: string
  media_url?: string
}

/**
 * Verify Webhook Secret using timing-safe comparison
 * @param headerSecret The X-Pinto-Secret header value from incoming request
 * @param configuredSecret The Webhook Secret configured in Developer Portal
 */
export function verifyWebhookSecret(headerSecret: string | null | undefined, configuredSecret: string): boolean {
  if (!headerSecret || !configuredSecret) return false
  if (headerSecret.length !== configuredSecret.length) return false

  let mismatch = 0
  for (let i = 0; i < headerSecret.length; i++) {
    mismatch |= headerSecret.charCodeAt(i) ^ configuredSecret.charCodeAt(i)
  }
  return mismatch === 0
}

/**
 * Parse incoming Webhook payload
 */
export function parseWebhookEvent(rawBody: string | Record<string, unknown>): WebhookEvent {
  if (typeof rawBody === 'string') {
    return JSON.parse(rawBody) as WebhookEvent
  }
  return rawBody as WebhookEvent
}

/**
 * Helper to construct a Webhook Reply response payload
 */
export function createReplyResponse(replyMessage: string, mediaUrl?: string): WebhookReplyPayload {
  const res: WebhookReplyPayload = { reply_message: replyMessage }
  if (mediaUrl) {
    res.media_url = mediaUrl
  }
  return res
}
