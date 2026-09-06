# Pinto SDK (Multi-Language Monorepo)

Official Software Development Kit (SDK) for **Pinto Developer Platform, Pinto SSO (OAuth 2.0 + PKCE), and Pinto Bot Webhooks**.

Repository นี้รวบรวม Official SDK ของ Pinto ครบทั้ง 3 ภาษาในที่เดียว:

* **[TypeScript / JavaScript](./typescript)** — สำหรับ Browser (React, Vue, Next.js, Nuxt) และ Node.js
* **[Golang](./go)** — สำหรับ Go Backend (Echo, Gin, net/http)
* **[Python](./python)** — สำหรับ Python Backend (FastAPI, Flask, Django)

---

## 📦 การติดตั้ง (Installation)

### 1. TypeScript / JavaScript
```bash
npm install pinto-sdk
# or
pnpm add pinto-sdk
```

### 2. Golang
```bash
go get github.com/fakduai-logistics-and-digital-platform/pinto-sdk/go
```

### 3. Python
```bash
pip install pinto-sdk
```

---

## 🚀 เปรียบเทียบตัวอย่างการใช้งาน (Quick Comparison)

### 1. สร้าง URL หน้า Login (พร้อม PKCE อัตโนมัติ)

#### 🔹 TypeScript / Browser (มีปุ่มสำเร็จรูปให้ใช้งานทันที!)
```ts
import { PintoAuth, renderPintoButton } from 'pinto-sdk'

const pinto = new PintoAuth({
  clientId: 'pinto-app_xxxxxxxx',
  redirectUri: 'https://myapp.com/auth/callback',
})

// สร้างและแปะปุ่ม Login with Pinto สำเร็จรูป (ปรับแต่งธีม/ขนาดได้ตามต้องการ)
renderPintoButton('#login-container', {
  auth: pinto,
  theme: 'dark',    // 'dark' | 'light' | 'brand' | 'outline'
  size: 'medium',   // 'small' | 'medium' | 'large'
  shape: 'rounded', // 'rounded' | 'pill' | 'square'
})
```

#### 🔹 Golang
```go
import "github.com/fakduai-logistics-and-digital-platform/pinto-sdk/go"

client, _ := pinto.New(pinto.Config{
    ClientID:    "pinto-app_xxxxxxxx",
    RedirectURI: "http://localhost:8080/auth/callback",
})

res, _ := client.GetAuthURL()
// res.URL -> นำทางผู้ใช้ไปที่นี่
// res.CodeVerifier -> บันทึกไว้ใน session เพื่อใช้ตอน callback
```

#### 🔹 Python
```python
from pinto import PintoAuth

auth = PintoAuth(
    client_id="pinto-app_xxxxxxxx",
    redirect_uri="http://localhost:5000/auth/callback",
)

res = auth.build_authorize_url()
# res.url -> นำทางผู้ใช้ไปที่นี่
# res.code_verifier -> บันทึกไว้ใน session เพื่อใช้ตอน callback
```

---

### 2. รับ Callback และแลก Token

#### 🔹 TypeScript / Browser
```ts
// ที่หน้า /auth/callback
const session = await pinto.handleRedirectCallback()
console.log(session.user, session.accessToken)
```

#### 🔹 Golang
```go
tokenResp, _ := client.ExchangeCode(ctx, code, verifier)
user, _ := client.GetUserProfile(ctx, tokenResp.AccessToken)
```

#### 🔹 Python
```python
tokens = auth.exchange_code(code=code, code_verifier=verifier)
user = auth.get_user_profile(access_token=tokens.access_token)
```

---

### 3. ตรวจสอบ Bot Webhook & ส่งข้อความตอบกลับ

#### 🔹 TypeScript (Node.js)
```ts
import { verifyWebhookSecret, parseWebhookEvent, createReplyResponse } from 'pinto-sdk'

if (verifyWebhookSecret(req.headers['x-pinto-secret'], 'WEBHOOK_SECRET')) {
  const event = parseWebhookEvent(req.body)
  return res.json(createReplyResponse(`สวัสดีครับ ${event.sender?.name}`))
}
```

#### 🔹 Golang
```go
if pinto.VerifyWebhookSecret(headerSecret, "WEBHOOK_SECRET") {
    event, _ := pinto.ParseWebhookEvent(r)
    return c.JSON(200, pinto.NewReplyResponse("สวัสดีครับ " + event.Sender.Name))
}
```

#### 🔹 Python
```python
from pinto import verify_webhook_secret, parse_webhook_event, create_reply_response

if verify_webhook_secret(header_secret, "WEBHOOK_SECRET"):
    event = parse_webhook_event(body)
    return create_reply_response(f"สวัสดีครับ {event.sender.name}")
```

---

## 📁 โครงสร้างโปรเจกต์ (Monorepo Directory)

```text
pinto-sdk/
├── typescript/        # pinto-sdk source & tests
├── go/                # github.com/fakduai-logistics-and-digital-platform/pinto-sdk/go
├── python/            # pinto-sdk source & tests
└── README.md          # เอกสารหน้านี้
```

---

## 📄 License

MIT © Pinto App
