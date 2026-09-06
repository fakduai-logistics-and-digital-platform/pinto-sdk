/**
 * Standard Pinto SDK error
 */
export class PintoAuthError extends Error {
  public readonly code: string
  public readonly details?: unknown

  constructor(message: string, code = 'PINTO_AUTH_ERROR', details?: unknown) {
    super(message)
    this.name = 'PintoAuthError'
    this.code = code
    this.details = details
    Object.setPrototypeOf(this, PintoAuthError.prototype)
  }
}

/**
 * OAuth Server Error returned by Pinto OAuth Server
 */
export class PintoOAuthServerError extends PintoAuthError {
  public readonly errorType: string
  public readonly errorDescription?: string

  constructor(errorType: string, errorDescription?: string, details?: unknown) {
    super(
      errorDescription ? `${errorType}: ${errorDescription}` : errorType,
      'OAUTH_SERVER_ERROR',
      details,
    )
    this.name = 'PintoOAuthServerError'
    this.errorType = errorType
    this.errorDescription = errorDescription
    Object.setPrototypeOf(this, PintoOAuthServerError.prototype)
  }
}
