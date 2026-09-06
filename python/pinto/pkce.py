import base64
import hashlib
import secrets

def generate_random_string(length: int = 32) -> str:
    """Generate a cryptographically secure URL-safe random string."""
    token = secrets.token_urlsafe(length)
    return token[:length]

def generate_code_verifier(length: int = 64) -> str:
    """Generate an RFC 7636 PKCE code_verifier (between 43 and 128 characters)."""
    valid_length = max(43, min(128, length))
    # token_urlsafe creates ~1.3 chars per byte
    byte_count = int(valid_length * 0.75) + 1
    return secrets.token_urlsafe(byte_count)[:valid_length]

def compute_code_challenge(verifier: str) -> str:
    """Compute SHA-256 Code Challenge from Code Verifier (RFC 7636 S256)."""
    digest = hashlib.sha256(verifier.encode('ascii')).digest()
    return base64.urlsafe_b64encode(digest).decode('ascii').rstrip('=')
