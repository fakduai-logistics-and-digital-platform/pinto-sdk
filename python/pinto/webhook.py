import hmac
import json
from typing import Optional, Dict, Any, Union
from .models import WebhookEvent, WebhookSender

def verify_webhook_secret(header_secret: Optional[str], configured_secret: str) -> bool:
    """Verify X-Pinto-Secret header using constant-time comparison."""
    if not header_secret or not configured_secret:
        return False
    return hmac.compare_digest(header_secret.strip(), configured_secret.strip())

def parse_webhook_event(raw_body: Union[str, bytes, Dict[str, Any]]) -> WebhookEvent:
    """Parse incoming Webhook event payload."""
    if isinstance(raw_body, (str, bytes)):
        data = json.loads(raw_body)
    else:
        data = raw_body

    sender_data = data.get("sender")
    sender = None
    if isinstance(sender_data, dict):
        sender = WebhookSender(
            user_id=sender_data.get("user_id", ""),
            name=sender_data.get("name", ""),
        )

    return WebhookEvent(
        event=data.get("event", ""),
        bot_id=data.get("bot_id"),
        chat_id=data.get("chat_id"),
        message_id=data.get("message_id"),
        sender=sender,
        message=data.get("message"),
        timestamp=data.get("timestamp"),
        raw=data,
    )

def create_reply_response(reply_message: str, media_url: Optional[str] = None) -> Dict[str, str]:
    """Create a dictionary payload to return as HTTP JSON response to Pinto."""
    payload = {"reply_message": reply_message}
    if media_url:
        payload["media_url"] = media_url
    return payload
