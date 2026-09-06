package pinto

import "time"

// Config represents Pinto SDK client configuration
type Config struct {
	ClientID     string
	ClientSecret string
	RedirectURI  string
	SSOBaseURL   string // defaults to https://api.pinto-app.com
	HTTPTimeout  time.Duration
}

// AuthorizeURLResult contains the generated authorization URL and the PKCE verifier to store
type AuthorizeURLResult struct {
	URL          string
	CodeVerifier string
	State        string
}

// AuthorizeOptions allows customization of the authorization request
type AuthorizeOptions struct {
	State    string
	Scope    string // e.g. "openid profile email"
	Resource string
	Prompt   string
}

// TokenResponse represents the OAuth token response from Pinto
type TokenResponse struct {
	AccessToken  string `json:"access_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
	RefreshToken string `json:"refresh_token,omitempty"`
	Scope        string `json:"scope,omitempty"`
	IDToken      string `json:"id_token,omitempty"`
}

// UserProfile represents the user info retrieved from Pinto SSO
type UserProfile struct {
	Sub     string `json:"sub"`
	ID      string `json:"id,omitempty"`
	Name    string `json:"name,omitempty"`
	Email   string `json:"email,omitempty"`
	Picture string `json:"picture,omitempty"`
}

// WebhookSender represents the message sender in a webhook event
type WebhookSender struct {
	UserID string `json:"user_id"`
	Name   string `json:"name"`
}

// WebhookEvent represents an incoming event from Pinto Bot Platform
type WebhookEvent struct {
	Event     string        `json:"event"` // e.g. "ping", "message.created"
	BotID     string        `json:"bot_id,omitempty"`
	ChatID    string        `json:"chat_id,omitempty"`
	MessageID string        `json:"message_id,omitempty"`
	Sender    WebhookSender `json:"sender,omitempty"`
	Message   string        `json:"message,omitempty"`
	Timestamp string        `json:"timestamp"`
}

// WebhookReply represents the reply JSON response to return to Pinto Bot Platform
type WebhookReply struct {
	ReplyMessage string `json:"reply_message"`
	MediaURL     string `json:"media_url,omitempty"`
}
