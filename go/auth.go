package pinto

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// Client is the main Pinto SDK Client for Go
type Client struct {
	config     Config
	httpClient *http.Client
}

// New creates a new Pinto Client instance
func New(cfg Config) (*Client, error) {
	if strings.TrimSpace(cfg.ClientID) == "" {
		return nil, errors.New("pinto: ClientID is required")
	}
	if strings.TrimSpace(cfg.RedirectURI) == "" {
		return nil, errors.New("pinto: RedirectURI is required")
	}
	if cfg.SSOBaseURL == "" {
		cfg.SSOBaseURL = "https://api.pinto-app.com"
	}
	cfg.SSOBaseURL = strings.TrimRight(cfg.SSOBaseURL, "/")

	timeout := cfg.HTTPTimeout
	if timeout <= 0 {
		timeout = 15 * time.Second
	}

	return &Client{
		config: cfg,
		httpClient: &http.Client{
			Timeout: timeout,
		},
	}, nil
}

// GetAuthURL generates the OAuth 2.0 Authorization URL with PKCE parameters
func (c *Client) GetAuthURL(opts ...AuthorizeOptions) (*AuthorizeURLResult, error) {
	var opt AuthorizeOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	verifier := GenerateCodeVerifier(64)
	challenge := ComputeCodeChallenge(verifier)

	state := opt.State
	if state == "" {
		state = GenerateRandomString(16)
	}

	scope := opt.Scope
	if scope == "" {
		scope = "openid profile email"
	}

	params := url.Values{
		"response_type":         {"code"},
		"client_id":             {c.config.ClientID},
		"redirect_uri":          {c.config.RedirectURI},
		"scope":                 {scope},
		"state":                 {state},
		"code_challenge":        {challenge},
		"code_challenge_method": {"S256"},
	}

	if opt.Resource != "" {
		params.Set("resource", opt.Resource)
	}
	if opt.Prompt != "" {
		params.Set("prompt", opt.Prompt)
	}

	authURL := fmt.Sprintf("%s/oauth/authorize?%s", c.config.SSOBaseURL, params.Encode())

	return &AuthorizeURLResult{
		URL:          authURL,
		CodeVerifier: verifier,
		State:        state,
	}, nil
}

// ExchangeCode exchanges an authorization code for an Access Token using the PKCE verifier
func (c *Client) ExchangeCode(ctx context.Context, code, codeVerifier string) (*TokenResponse, error) {
	if code == "" {
		return nil, errors.New("pinto: authorization code is required")
	}
	if codeVerifier == "" {
		return nil, errors.New("pinto: code_verifier is required for PKCE token exchange")
	}

	tokenURL := fmt.Sprintf("%s/oauth/token", c.config.SSOBaseURL)
	formData := url.Values{
		"grant_type":    {"authorization_code"},
		"client_id":     {c.config.ClientID},
		"code":          {code},
		"redirect_uri":  {c.config.RedirectURI},
		"code_verifier": {codeVerifier},
	}
	if c.config.ClientSecret != "" {
		formData.Set("client_secret", c.config.ClientSecret)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, tokenURL, strings.NewReader(formData.Encode()))
	if err != nil {
		return nil, fmt.Errorf("pinto: failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("pinto: token request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("pinto: failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("pinto: token exchange failed (HTTP %d): %s", resp.StatusCode, string(body))
	}

	var tokenResp TokenResponse
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return nil, fmt.Errorf("pinto: failed to decode token response: %w", err)
	}

	return &tokenResp, nil
}

// GetUserProfile retrieves the user's profile info using the access token
func (c *Client) GetUserProfile(ctx context.Context, accessToken string) (*UserProfile, error) {
	if accessToken == "" {
		return nil, errors.New("pinto: access token is required")
	}

	userinfoURL := fmt.Sprintf("%s/oauth/userinfo", c.config.SSOBaseURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, userinfoURL, nil)
	if err != nil {
		return nil, fmt.Errorf("pinto: failed to create userinfo request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("pinto: userinfo request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("pinto: failed to read userinfo response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("pinto: userinfo request failed (HTTP %d): %s", resp.StatusCode, string(body))
	}

	var profile UserProfile
	if err := json.Unmarshal(body, &profile); err != nil {
		return nil, fmt.Errorf("pinto: failed to decode userinfo: %w", err)
	}

	return &profile, nil
}

// RefreshToken refreshes an access token using a refresh token
func (c *Client) RefreshToken(ctx context.Context, refreshToken string) (*TokenResponse, error) {
	if refreshToken == "" {
		return nil, errors.New("pinto: refresh token is required")
	}

	tokenURL := fmt.Sprintf("%s/oauth/token", c.config.SSOBaseURL)
	formData := url.Values{
		"grant_type":    {"refresh_token"},
		"client_id":     {c.config.ClientID},
		"refresh_token": {refreshToken},
	}
	if c.config.ClientSecret != "" {
		formData.Set("client_secret", c.config.ClientSecret)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, tokenURL, strings.NewReader(formData.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("pinto: refresh token failed (HTTP %d): %s", resp.StatusCode, string(body))
	}

	var tokenResp TokenResponse
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return nil, err
	}

	return &tokenResp, nil
}
