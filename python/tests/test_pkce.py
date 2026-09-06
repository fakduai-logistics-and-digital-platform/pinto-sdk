import unittest
from pinto.pkce import generate_random_string, generate_code_verifier, compute_code_challenge

class TestPKCE(unittest.TestCase):
    def test_generate_random_string(self):
        s1 = generate_random_string(16)
        s2 = generate_random_string(32)
        self.assertEqual(len(s1), 16)
        self.assertEqual(len(s2), 32)
        self.assertNotEqual(s1, s2)

    def test_generate_code_verifier(self):
        short = generate_code_verifier(10)
        normal = generate_code_verifier(64)
        long = generate_code_verifier(200)

        self.assertEqual(len(short), 43)
        self.assertEqual(len(normal), 64)
        self.assertEqual(len(long), 128)

    def test_compute_code_challenge_rfc7636(self):
        verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
        expected = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"

        challenge = compute_code_challenge(verifier)
        self.assertEqual(challenge, expected)

if __name__ == "__main__":
    unittest.main()
