import unittest
from pinto.webhook import verify_webhook_secret, parse_webhook_event, create_reply_response

class TestWebhook(unittest.TestCase):
    def test_verify_webhook_secret(self):
        self.assertTrue(verify_webhook_secret("my_secret", "my_secret"))
        self.assertFalse(verify_webhook_secret("wrong_secret", "my_secret"))
        self.assertFalse(verify_webhook_secret(None, "my_secret"))
        self.assertFalse(verify_webhook_secret("", "my_secret"))

    def test_parse_webhook_event(self):
        body = """{
            "event": "message.created",
            "bot_id": "bot_1",
            "chat_id": "chat_1",
            "message": "Hello Python!",
            "sender": {"user_id": "u_9", "name": "Charlie"},
            "timestamp": "2026-09-06T12:00:00Z"
        }"""
        event = parse_webhook_event(body)
        self.assertEqual(event.event, "message.created")
        self.assertEqual(event.message, "Hello Python!")
        self.assertIsNotNone(event.sender)
        self.assertEqual(event.sender.name, "Charlie")

    def test_create_reply_response(self):
        reply = create_reply_response("Got it!", "https://img.jpg")
        self.assertEqual(reply, {"reply_message": "Got it!", "media_url": "https://img.jpg"})

if __name__ == "__main__":
    unittest.main()
