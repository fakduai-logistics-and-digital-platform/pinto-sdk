# pinto-sdk-python

Official Python SDK for **Pinto Developer Platform & Pinto SSO (OAuth 2.0 + PKCE)**.

**Zero External Dependencies** — ใช้เฉพาะ Python Standard Library (`urllib`, `hashlib`, `hmac`, `secrets`)

---

## 📦 Installation

```bash
pip install pinto-sdk
```

---

## 🚀 Quickstart

### 1. Initialize Client

```python
from pinto import PintoAuth

auth = PintoAuth(
    client_id="pinto-app_xxxxxxxxxxxx",
    client_secret="optional_client_secret",
    redirect_uri="http://localhost:5000/auth/callback",
    # sso_base_url="https://api-dev.pinto-app.com", # For dev environment
)
```

---

### 2. Login & Generate Auth URL with PKCE (FastAPI / Flask)

```python
# ตัวอย่างใน FastAPI หรือ Flask
@app.get("/auth/login")
def login(request: Request):
    result = auth.build_authorize_url()

    # บันทึก result.code_verifier คู่กับ result.state ลงใน Server Session หรือ Redis
    request.session[f"verifier_{result.state}"] = result.code_verifier

    return RedirectResponse(url=result.url)
```

---

### 3. Handle Callback & Exchange Token

```python
@app.get("/auth/callback")
def callback(code: str, state: str, request: Request):
    # ดึง code_verifier ที่บันทึกไว้
    verifier = request.session.pop(f"verifier_{state}", None)
    if not verifier:
        raise HTTPException(status_code=400, detail="Invalid state or verifier expired")

    # แลก Token ด้วย PKCE
    tokens = auth.exchange_code(code=code, code_verifier=verifier)

    # ดึงข้อมูล User Profile
    user = auth.get_user_profile(access_token=tokens.access_token)

    return {
        "user": user.name,
        "email": user.email,
        "token": tokens.access_token,
    }
```

---

### 4. Pinto Bot Webhook Handler

```python
from pinto import verify_webhook_secret, parse_webhook_event, create_reply_response

@app.post("/webhook")
async def webhook(request: Request):
    # 1. ตรวจสอบ Secret ป้องกัน Request ปลอม
    header_secret = request.headers.get("X-Pinto-Secret")
    if not verify_webhook_secret(header_secret, "YOUR_WEBHOOK_SECRET"):
        raise HTTPException(status_code=401, detail="Unauthorized")

    # 2. Parse Event
    body = await request.json()
    event = parse_webhook_event(body)

    if event.event == "message.created":
        # 3. ตอบกลับข้อความทันที
        return create_reply_response(f"สวัสดีครับคุณ {event.sender.name}!")

    return {"status": "ok"}
```

---

## 📄 License

MIT © Pinto App
