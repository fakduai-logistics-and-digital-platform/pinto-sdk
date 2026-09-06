"""
Official Pinto SDK for Python (SSO Auth, PKCE, and Bot Webhooks).
"""

from .auth import PintoAuth
from .errors import PintoError, PintoOAuthError
from .models import (
    AuthorizeURLResult,
    TokenResponse,
    UserProfile,
    WebhookEvent,
    WebhookReply,
    WebhookSender,
)
from .pkce import (
    compute_code_challenge,
    generate_code_verifier,
    generate_random_string,
)
from .webhook import (
    create_reply_response,
    parse_webhook_event,
    verify_webhook_secret,
)

PintoClient = PintoAuth

__all__ = [
    "PintoAuth",
    "PintoClient",
    "PintoError",
    "PintoOAuthError",
    "AuthorizeURLResult",
    "TokenResponse",
    "UserProfile",
    "WebhookEvent",
    "WebhookReply",
    "WebhookSender",
    "compute_code_challenge",
    "generate_code_verifier",
    "generate_random_string",
    "create_reply_response",
    "parse_webhook_event",
    "verify_webhook_secret",
]
