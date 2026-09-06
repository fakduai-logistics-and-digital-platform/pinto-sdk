class PintoError(Exception):
    """Base exception for Pinto SDK"""
    pass

class PintoOAuthError(PintoError):
    """OAuth error returned by Pinto Authorization Server"""
    def __init__(self, error: str, error_description: str = "", status_code: int = 400):
        self.error = error
        self.error_description = error_description
        self.status_code = status_code
        message = f"{error}: {error_description}" if error_description else error
        super().__init__(message)
