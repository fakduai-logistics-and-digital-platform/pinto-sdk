# @pinto-app/sdk

Official JavaScript/TypeScript SDK for **Pinto Developer Platform & Pinto SSO (OAuth 2.0 + PKCE)**.

รองรับทั้ง **Browser (React, Vue, Nuxt, Next.js, Svelte, Vanilla JS)** และ **Node.js 18+** โดย **Zero Dependencies** (ใช้มาตรฐาน Web Cryptography API และ standard fetch ในตัว)

---

## 📦 การติดตั้ง (Installation)

```bash
# npm
npm install @pinto-app/sdk

# pnpm
pnpm add @pinto-app/sdk

# yarn
yarn add @pinto-app/sdk
```

---

## 🚀 เริ่มต้นใช้งานอย่างรวดเร็ว (Quickstart)

### 1. กำหนดค่า PintoAuth (Initialization)

สร้าง instance ของ `PintoAuth` ด้วย `clientId` และ `redirectUri` ที่ลงทะเบียนไว้ใน [Pinto Developer Portal](https://developers.pinto-app.com):

```ts
import { PintoAuth } from '@pinto-app/sdk'

export const pinto = new PintoAuth({
  clientId: 'pinto-app_xxxxxxxxxxxx',
  redirectUri: 'https://myapp.com/auth/callback',
  // ตัวเลือกเพิ่มเติม (Optional):
  // ssoBaseUrl: 'https://api-dev.pinto-app.com', // สำหรับ Dev environment (default: https://api.pinto-app.com)
  // scope: ['openid', 'profile', 'email'],        // default: openid, profile, email
})
```

---

### 2. นำทางผู้ใช้ไปหน้า Login (`loginWithRedirect`)

ผูกกับปุ่ม "Log in with Pinto":

```ts
// SDK จะสร้าง PKCE code_verifier, code_challenge (S256), state
// และบันทึกลงใน sessionStorage ให้อัตโนมัติ ก่อน redirect ไปหน้า Pinto Login
await pinto.loginWithRedirect()
```

> **หรือถ้าต้องการแค่ URL ไปจัดการต่อเอง:**
> ```ts
> const url = await pinto.buildAuthorizeUrl()
> window.location.href = url
> ```

---

### 3. จัดการที่หน้า Callback (`handleRedirectCallback`)

ที่หน้า `/auth/callback`:

```ts
import { pinto } from './pinto'

async function initCallback() {
  try {
    // SDK จะอ่าน code และ state จาก URL, ตรวจสอบความถูกต้อง,
    // นำ code_verifier ไปแลก token และดึงข้อมูลผู้ใช้ให้ทันที
    const session = await pinto.handleRedirectCallback()

    console.log('Access Token:', session.accessToken)
    console.log('User Profile:', session.user)

    // พากลับไปหน้าหลัก
    window.location.href = '/dashboard'
  } catch (err) {
    console.error('Login failed:', err)
  }
}

initCallback()
```

---

### 4. ดึงข้อมูลผู้ใช้และตรวจสอบสถานะในจุดอื่นๆ ของแอป

```ts
// ตรวจสอบว่าล็อกอินอยู่หรือไม่
const isAuthed = await pinto.isAuthenticated()

// ดึง Access Token (จะตรวจสอบวันหมดอายุให้อัตโนมัติ)
const token = await pinto.getAccessToken()

// ดึงข้อมูล User Profile ปัจจุบัน
const user = await pinto.getUser()
console.log('Hello', user?.name, user?.email)

// ล็อกเอาต์ (ล้าง session)
await pinto.logout()
```

---

## 🛠️ Low-Level PKCE Helpers (หากต้องการคำนวณเอง)

หากคุณต้องการคำนวณ PKCE ด้วยตัวเอง สามารถเรียกใช้ฟังก์ชัน utility ได้โดยตรง:

```ts
import {
  generateRandomString,
  generateCodeVerifier,
  computeCodeChallenge,
} from '@pinto-app/sdk'

// สร้าง Code Verifier (RFC 7636)
const verifier = generateCodeVerifier(64)

// คำนวณ Code Challenge (S256 Base64URL)
const challenge = await computeCodeChallenge(verifier)

console.log({ verifier, challenge })
```

---

## ⚙️ Configuration Reference

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `clientId` | `string` | **Yes** | - | Client ID ที่ได้จาก Developer Portal |
| `redirectUri` | `string` | **Yes** | - | Callback URL ที่ต้องตรงกับที่ระบุใน Portal |
| `ssoBaseUrl` | `string` | No | `'https://api.pinto-app.com'` | API Base URL ของ Pinto SSO |
| `scope` | `string \| string[]` | No | `['openid', 'profile', 'email']` | สิทธิ์ที่ต้องการขอจากผู้ใช้ |
| `storage` | `StorageAdapter` | No | `SessionStorageAdapter` | Storage ที่ใช้เก็บ session และ state |
| `storageKeyPrefix` | `string` | No | `'pinto_auth_'` | Prefix สำหรับ key ใน storage |

---

## 📄 License

MIT © Pinto App
