package pinto

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
)

// GenerateRandomString generates a secure random URL-safe string
func GenerateRandomString(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

// GenerateCodeVerifier generates an RFC 7636 PKCE code_verifier (default 64 chars)
func GenerateCodeVerifier(length ...int) string {
	l := 64
	if len(length) > 0 {
		l = length[0]
	}
	if l < 43 {
		l = 43
	}
	if l > 128 {
		l = 128
	}
	// 3/4 bytes to base64 ratio roughly
	byteLen := (l * 3) / 4
	s := GenerateRandomString(byteLen)
	if len(s) > l {
		return s[:l]
	}
	return s
}

// ComputeCodeChallenge computes the SHA-256 code_challenge for S256 method
func ComputeCodeChallenge(verifier string) string {
	h := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(h[:])
}
