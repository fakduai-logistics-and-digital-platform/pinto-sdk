from dataclasses import dataclass
from typing import Optional, Dict, Any

@dataclass
class AuthorizeURLResult:
    url: str
    code_verifier: str
    state: str

@dataclass
class TokenResponse:
    access_token: str
    token_type: str
    expires_in: int
    refresh_token: Optional[str] = None
    scope: Optional[str] = None
    id_token: Optional[str] = None

@dataclass
class UserProfile:
    sub: str
    id: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    picture: Optional[str] = None
    raw: Optional[Dict[str, Any]] = None

@dataclass
class WebhookSender:
    user_id: str
    name: str

@dataclass
class WebhookEvent:
    event: str
    bot_id: Optional[str] = None
    chat_id: Optional[str] = None
    message_id: Optional[str] = None
    sender: Optional[WebhookSender] = None
    message: Optional[str] = None
    timestamp: Optional[str] = None
    raw: Optional[Dict[str, Any]] = None

@dataclass
class WebhookReply:
    reply_message: str
    media_url: Optional[str] = None
