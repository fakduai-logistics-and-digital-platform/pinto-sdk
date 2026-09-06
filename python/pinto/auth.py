import json
import urllib.parse
import urllib.request
import urllib.error
from typing import Optional, List, Union, Dict, Any

from .errors import PintoError, PintoOAuthError
from .models import AuthorizeURLResult, TokenResponse, UserProfile
from .pkce import generate_code_verifier, compute_code_challenge, generate_random_string

class PintoAuth:
    """Pinto OAuth 2.0 & SSO Client for Python Backend."""

    def __init__(
        self,
        client_id: str,
        redirect_uri: str,
        client_secret: Optional[str] = None,
        sso_base_url: str = "https://api.pinto-app.com",
        timeout: float = 15.0,
    ):
        if not client_id:
            raise PintoError("client_id is required")
        if not redirect_uri:
            raise PintoError("redirect_uri is required")

        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri
        self.sso_base_url = sso_base_url.rstrip("/")
        self.timeout = timeout

    def build_authorize_url(
        self,
        state: Optional[str] = None,
        scope: Optional[Union[str, List[str]]] = None,
        resource: Optional[str] = None,
        prompt: Optional[str] = None,
    ) -> AuthorizeURLResult:
        """Generate Pinto OAuth Authorization URL with PKCE parameters."""
        verifier = generate_code_verifier(64)
        challenge = compute_code_challenge(verifier)

        if not state:
            state = generate_random_string(16)

        if scope is None:
            scope_str = "openid profile email"
        elif isinstance(scope, list):
            scope_str = " ".join(scope)
        else:
            scope_str = scope

        params = {
            "response_type": "code",
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "scope": scope_str,
            "state": state,
            "code_challenge": challenge,
            "code_challenge_method": "S256",
        }
        if resource:
            params["resource"] = resource
        if prompt:
            params["prompt"] = prompt

        query_string = urllib.parse.urlencode(params)
        auth_url = f"{self.sso_base_url}/oauth/authorize?{query_string}"

        return AuthorizeURLResult(
            url=auth_url,
            code_verifier=verifier,
            state=state,
        )

    def exchange_code(
        self,
        code: str,
        code_verifier: str,
        redirect_uri: Optional[str] = None,
    ) -> TokenResponse:
        """Exchange authorization code for an Access Token using PKCE code_verifier."""
        if not code:
            raise PintoError("code is required")
        if not code_verifier:
            raise PintoError("code_verifier is required for PKCE")

        token_url = f"{self.sso_base_url}/oauth/token"
        data = {
            "grant_type": "authorization_code",
            "client_id": self.client_id,
            "code": code,
            "redirect_uri": redirect_uri or self.redirect_uri,
            "code_verifier": code_verifier,
        }
        if self.client_secret:
            data["client_secret"] = self.client_secret

        encoded_data = urllib.parse.urlencode(data).encode("utf-8")
        req = urllib.request.Request(
            token_url,
            data=encoded_data,
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as response:
                body = json.loads(response.read().decode("utf-8"))
                return TokenResponse(
                    access_token=body["access_token"],
                    token_type=body.get("token_type", "Bearer"),
                    expires_in=body.get("expires_in", 3600),
                    refresh_token=body.get("refresh_token"),
                    scope=body.get("scope"),
                    id_token=body.get("id_token"),
                )
        except urllib.error.HTTPError as e:
            try:
                err_data = json.loads(e.read().decode("utf-8"))
                raise PintoOAuthError(
                    error=err_data.get("error", "token_exchange_failed"),
                    error_description=err_data.get("error_description", ""),
                    status_code=e.code,
                )
            except (json.JSONDecodeError, UnicodeDecodeError):
                raise PintoOAuthError(
                    error="http_error",
                    error_description=f"HTTP {e.code}: {e.reason}",
                    status_code=e.code,
                )
        except Exception as e:
            raise PintoError(f"Token exchange failed: {e}")

    def get_user_profile(self, access_token: str) -> UserProfile:
        """Fetch user profile information from Pinto SSO."""
        if not access_token:
            raise PintoError("access_token is required")

        userinfo_url = f"{self.sso_base_url}/oauth/userinfo"
        req = urllib.request.Request(
            userinfo_url,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/json",
            },
            method="GET",
        )

        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as response:
                body = json.loads(response.read().decode("utf-8"))
                return UserProfile(
                    sub=body.get("sub", ""),
                    id=body.get("id"),
                    name=body.get("name"),
                    email=body.get("email"),
                    picture=body.get("picture"),
                    raw=body,
                )
        except urllib.error.HTTPError as e:
            raise PintoError(f"Failed to fetch userinfo (HTTP {e.code})")
        except Exception as e:
            raise PintoError(f"Failed to fetch userinfo: {e}")

    def refresh_token(self, refresh_token: str) -> TokenResponse:
        """Refresh an expired access token using a refresh token."""
        if not refresh_token:
            raise PintoError("refresh_token is required")

        token_url = f"{self.sso_base_url}/oauth/token"
        data = {
            "grant_type": "refresh_token",
            "client_id": self.client_id,
            "refresh_token": refresh_token,
        }
        if self.client_secret:
            data["client_secret"] = self.client_secret

        encoded_data = urllib.parse.urlencode(data).encode("utf-8")
        req = urllib.request.Request(
            token_url,
            data=encoded_data,
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as response:
                body = json.loads(response.read().decode("utf-8"))
                return TokenResponse(
                    access_token=body["access_token"],
                    token_type=body.get("token_type", "Bearer"),
                    expires_in=body.get("expires_in", 3600),
                    refresh_token=body.get("refresh_token") or refresh_token,
                    scope=body.get("scope"),
                )
        except Exception as e:
            raise PintoError(f"Refresh token failed: {e}")
