package pinto

import (
	"crypto/subtle"
	"encoding/json"
	"errors"
	"io"
	"net/http"
)

// VerifyWebhookSecret validates incoming X-Pinto-Secret header against configured secret
// using constant-time comparison to prevent timing attacks.
func VerifyWebhookSecret(headerSecret, configuredSecret string) bool {
	if headerSecret == "" || configuredSecret == "" {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(headerSecret), []byte(configuredSecret)) == 1
}

// ParseWebhookEvent parses an incoming HTTP request from Pinto Bot Webhook
func ParseWebhookEvent(r *http.Request) (*WebhookEvent, error) {
	if r == nil || r.Body == nil {
		return nil, errors.New("pinto: request or body is nil")
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		return nil, err
	}

	var event WebhookEvent
	if err := json.Unmarshal(body, &event); err != nil {
		return nil, err
	}

	return &event, nil
}

// NewReplyResponse creates a Webhook reply payload
func NewReplyResponse(message string, mediaURL ...string) *WebhookReply {
	reply := &WebhookReply{
		ReplyMessage: message,
	}
	if len(mediaURL) > 0 && mediaURL[0] != "" {
		reply.MediaURL = mediaURL[0]
	}
	return reply
}
