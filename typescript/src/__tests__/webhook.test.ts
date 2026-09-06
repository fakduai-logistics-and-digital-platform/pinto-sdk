import { describe, expect, it } from 'vitest'
import {
  createReplyResponse,
  parseWebhookEvent,
  verifyWebhookSecret,
} from '../webhook.js'

describe('Webhook Utilities', () => {
  it('verifies webhook secret securely', () => {
    expect(verifyWebhookSecret('my-secret-key', 'my-secret-key')).toBe(true)
    expect(verifyWebhookSecret('wrong-secret', 'my-secret-key')).toBe(false)
    expect(verifyWebhookSecret(null, 'my-secret-key')).toBe(false)
    expect(verifyWebhookSecret('short', 'my-secret-key')).toBe(false)
  })

  it('parses incoming webhook message event', () => {
    const raw = JSON.stringify({
      event: 'message.created',
      bot_id: 'bot_123',
      chat_id: 'chat_456',
      message_id: 'msg_789',
      sender: { user_id: 'u_1', name: 'Alice' },
      message: 'Hello bot!',
      timestamp: '2026-09-06T12:00:00Z',
    })

    const event = parseWebhookEvent(raw)
    expect(event.event).toBe('message.created')
    if (event.event === 'message.created') {
      expect(event.sender.name).toBe('Alice')
      expect(event.message).toBe('Hello bot!')
    }
  })

  it('creates reply response payload correctly', () => {
    const reply = createReplyResponse('Hello from bot!', 'https://example.com/image.png')
    expect(reply.reply_message).toBe('Hello from bot!')
    expect(reply.media_url).toBe('https://example.com/image.png')
  })
})
