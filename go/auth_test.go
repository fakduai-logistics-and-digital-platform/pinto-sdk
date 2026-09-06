package pinto

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
)

func TestAuthClient(t *testing.T) {
	t.Run("Validates config", func(t *testing.T) {
		_, err := New(Config{})
		if err == nil {
			t.Fatal("expected error on empty config")
		}
	})

	t.Run("Generates Auth URL with PKCE", func(t *testing.T) {
		client, err := New(Config{
			ClientID:    "pinto-app_test",
			RedirectURI: "http://localhost:8080/cb",
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		res, err := client.GetAuthURL(AuthorizeOptions{State: "s123"})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		u, err := url.Parse(res.URL)
		if err != nil {
			t.Fatalf("invalid URL: %v", err)
		}

		q := u.Query()
		if q.Get("client_id") != "pinto-app_test" {
			t.Errorf("wrong client_id: %s", q.Get("client_id"))
		}
		if q.Get("response_type") != "code" {
			t.Errorf("wrong response_type: %s", q.Get("response_type"))
		}
		if q.Get("code_challenge_method") != "S256" {
			t.Errorf("wrong code_challenge_method: %s", q.Get("code_challenge_method"))
		}
		if q.Get("code_challenge") == "" {
			t.Error("missing code_challenge")
		}
		if res.CodeVerifier == "" {
			t.Error("missing CodeVerifier")
		}
		if res.State != "s123" {
			t.Errorf("wrong state: %s", res.State)
		}
	})

	t.Run("ExchangeCode and GetUserProfile", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/oauth/token" {
				if err := r.ParseForm(); err != nil {
					t.Fatalf("failed to parse form: %v", err)
				}
				if r.Form.Get("code_verifier") == "" {
					t.Fatal("missing code_verifier in token request")
				}
				json.NewEncoder(w).Encode(TokenResponse{
					AccessToken: "access_token_123",
					TokenType:   "Bearer",
					ExpiresIn:   3600,
				})
				return
			}
			if r.URL.Path == "/oauth/userinfo" {
				authHeader := r.Header.Get("Authorization")
				if authHeader != "Bearer access_token_123" {
					t.Fatalf("wrong auth header: %s", authHeader)
				}
				json.NewEncoder(w).Encode(UserProfile{
					Sub:   "usr_1",
					Name:  "Test User",
					Email: "test@example.com",
				})
				return
			}
			http.NotFound(w, r)
		}))
		defer server.Close()

		client, err := New(Config{
			ClientID:    "test_client",
			RedirectURI: "http://localhost:8080/cb",
			SSOBaseURL:  server.URL,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		token, err := client.ExchangeCode(context.Background(), "mock_code", "mock_verifier")
		if err != nil {
			t.Fatalf("failed to exchange code: %v", err)
		}
		if token.AccessToken != "access_token_123" {
			t.Errorf("wrong token: %s", token.AccessToken)
		}

		profile, err := client.GetUserProfile(context.Background(), token.AccessToken)
		if err != nil {
			t.Fatalf("failed to get profile: %v", err)
		}
		if profile.Name != "Test User" {
			t.Errorf("wrong profile name: %s", profile.Name)
		}
	})
}
