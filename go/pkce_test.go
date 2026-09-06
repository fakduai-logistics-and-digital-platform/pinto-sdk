package pinto

import (
	"testing"
)

func TestPKCEUtils(t *testing.T) {
	t.Run("GenerateRandomString length", func(t *testing.T) {
		s1 := GenerateRandomString(16)
		s2 := GenerateRandomString(32)
		if len(s1) == 0 || len(s2) == 0 {
			t.Fatal("generated string should not be empty")
		}
		if s1 == s2 {
			t.Fatal("random strings should be distinct")
		}
	})

	t.Run("GenerateCodeVerifier clamp", func(t *testing.T) {
		short := GenerateCodeVerifier(10)
		normal := GenerateCodeVerifier(64)
		long := GenerateCodeVerifier(200)

		if len(short) != 43 {
			t.Fatalf("expected 43, got %d", len(short))
		}
		if len(normal) != 64 {
			t.Fatalf("expected 64, got %d", len(normal))
		}
		if len(long) != 128 {
			t.Fatalf("expected 128, got %d", len(long))
		}
	})

	t.Run("ComputeCodeChallenge against RFC 7636 Appendix B", func(t *testing.T) {
		verifier := "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
		expectedChallenge := "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"

		challenge := ComputeCodeChallenge(verifier)
		if challenge != expectedChallenge {
			t.Fatalf("expected %s, got %s", expectedChallenge, challenge)
		}
	})
}
