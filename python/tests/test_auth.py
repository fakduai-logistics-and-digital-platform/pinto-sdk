import unittest
import urllib.parse
from pinto.auth import PintoAuth
from pinto.errors import PintoError

class TestAuth(unittest.TestCase):
    def test_pinto_auth_validation(self):
        with self.assertRaises(PintoError):
            PintoAuth(client_id="", redirect_uri="http://localhost")
        with self.assertRaises(PintoError):
            PintoAuth(client_id="id", redirect_uri="")

    def test_build_authorize_url(self):
        auth = PintoAuth(
            client_id="pinto-app_py123",
            redirect_uri="http://localhost:5000/callback",
            sso_base_url="https://api-dev.pinto-app.com",
        )
        result = auth.build_authorize_url(state="custom_state")

        self.assertEqual(result.state, "custom_state")
        self.assertGreaterEqual(len(result.code_verifier), 43)

        parsed = urllib.parse.urlparse(result.url)
        self.assertEqual(parsed.scheme, "https")
        self.assertEqual(parsed.netloc, "api-dev.pinto-app.com")
        self.assertEqual(parsed.path, "/oauth/authorize")

        query = urllib.parse.parse_qs(parsed.query)
        self.assertEqual(query["client_id"], ["pinto-app_py123"])
        self.assertEqual(query["response_type"], ["code"])
        self.assertEqual(query["code_challenge_method"], ["S256"])
        self.assertIn("code_challenge", query)
        self.assertEqual(query["state"], ["custom_state"])

if __name__ == "__main__":
    unittest.main()
