package pinto

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestWebhookUtils(t *testing.T) {
	t.Run("VerifyWebhookSecret", func(t *testing.T) {
		if !VerifyWebhookSecret("secret123", "secret123") {
			t.Error("expected true on matching secret")
		}
		if VerifyWebhookSecret("wrong", "secret123") {
			t.Error("expected false on wrong secret")
		}
		if VerifyWebhookSecret("", "secret123") {
			t.Error("expected false on empty header")
		}
	})

	t.Run("ParseWebhookEvent", func(t *testing.T) {
		body := `{"event":"message.created","bot_id":"b1","chat_id":"c1","message":"hello","sender":{"user_id":"u1","name":"Bob"},"timestamp":"2026-09-06T12:00:00Z"}`
		req := httptest.NewRequest(http.MethodPost, "/webhook", bytes.NewBufferString(body))

		event, err := ParseWebhookEvent(req)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if event.Event != "message.created" {
			t.Errorf("wrong event: %s", event.Event)
		}
		if event.Sender.Name != "Bob" {
			t.Errorf("wrong sender: %s", event.Sender.Name)
		}
	})

	t.Run("NewReplyResponse", func(t *testing.T) {
		reply := NewReplyResponse("thanks", "https://img.jpg")
		if reply.ReplyMessage != "thanks" {
			t.Errorf("wrong reply message: %s", reply.ReplyMessage)
		}
		if reply.MediaURL != "https://img.jpg" {
			t.Errorf("wrong media url: %s", reply.MediaURL)
		}
	})
}
