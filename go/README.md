# pinto-sdk-go

Official Go SDK for **Pinto Developer Platform & Pinto SSO (OAuth 2.0 + PKCE)**.

**Zero Third-Party Dependencies** — ใช้เฉพาะ Go Standard Library เท่านั้น

---

## 📦 Installation

```bash
go get github.com/pinto-app/pinto-sdk-go
```

---

## 🚀 Quickstart

### 1. Initialize Client

```go
import "github.com/pinto-app/pinto-sdk-go"

client, err := pinto.New(pinto.Config{
    ClientID:     "pinto-app_xxxxxxxxxxxx",
    ClientSecret: "optional_secret_here",
    RedirectURI:  "http://localhost:8080/auth/callback",
    // SSOBaseURL: "https://api-dev.pinto-app.com", // For dev environment
})
```

---

### 2. Login & Generate Auth URL with PKCE

```go
// 1. Endpoint: /auth/login
e.GET("/auth/login", func(c echo.Context) error {
    res, err := client.GetAuthURL()
    if err != nil {
        return err
    }

    // เก็บ res.CodeVerifier คู่กับ res.State ลงใน Session หรือ Redis
    session.Set("verifier_"+res.State, res.CodeVerifier)

    return c.JSON(http.StatusOK, map[string]string{"url": res.URL})
})
```

---

### 3. Handle Callback & Exchange Token

```go
// 2. Endpoint: /auth/callback
e.GET("/auth/callback", func(c echo.Context) error {
    code := c.QueryParam("code")
    state := c.QueryParam("state")

    // ดึง CodeVerifier ที่เก็บไว้ตาม State
    verifier := session.Get("verifier_" + state)

    // แลก Token ด้วย PKCE
    tokenResp, err := client.ExchangeCode(c.Request().Context(), code, verifier)
    if err != nil {
        return c.String(http.StatusBadRequest, "Login failed: " + err.Error())
    }

    // ดึงข้อมูล User Profile
    user, err := client.GetUserProfile(c.Request().Context(), tokenResp.AccessToken)
    if err != nil {
        return err
    }

    // เก็บ user ใน Session หรือออก Cookie
    return c.JSON(http.StatusOK, user)
})
```

---

### 4. Pinto Bot Webhook Handler

```go
e.POST("/webhook", func(c echo.Context) error {
    // 1. ตรวจสอบ Secret จาก Header X-Pinto-Secret
    headerSecret := c.Request().Header.Get("X-Pinto-Secret")
    if !pinto.VerifyWebhookSecret(headerSecret, "YOUR_WEBHOOK_SECRET") {
        return c.String(http.StatusUnauthorized, "Unauthorized")
    }

    // 2. Parse Event
    event, err := pinto.ParseWebhookEvent(c.Request())
    if err != nil {
        return c.String(http.StatusBadRequest, "Invalid payload")
    }

    if event.Event == "message.created" {
        // 3. ตอบกลับข้อความทันที
        reply := pinto.NewReplyResponse("สวัสดีครับคุณ " + event.Sender.Name + "!")
        return c.JSON(http.StatusOK, reply)
    }

    return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
})
```

---

## 📄 License

MIT © Pinto App
