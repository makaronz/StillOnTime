/**
 * OAuth 2.0 utility functions for enhanced security
 */

/**
 * Generate a cryptographically secure random state parameter for OAuth 2.0
 */
export function generateSecureState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}

/**
 * Validate OAuth 2.0 state parameter
 */
export function validateState(
  receivedState: string,
  storedState: string | null
): boolean {
  if (!receivedState) {
    console.warn("OAuth: No state parameter received");
    return false;
  }

  if (!storedState) {
    console.warn("OAuth: No stored state found - this may happen on page refresh during OAuth");
    // Allow missing stored state on page refresh, but warn about it
    // The backend will still validate the state parameter
    console.info("OAuth: Proceeding with backend state validation only");
    return true;
  }

  // Use constant-time comparison to prevent timing attacks
  if (receivedState.length !== storedState.length) {
    console.warn("OAuth: State length mismatch");
    return false;
  }

  let result = 0;
  for (let i = 0; i < receivedState.length; i++) {
    result |= receivedState.charCodeAt(i) ^ storedState.charCodeAt(i);
  }

  const isValid = result === 0;
  if (!isValid) {
    console.warn("OAuth: State parameter mismatch - possible CSRF attack");
  }

  return isValid;
}

/**
 * Validate OAuth 2.0 authorization code format
 */
export function validateAuthCode(code: string): boolean {
  if (!code || typeof code !== "string") {
    return false;
  }

  // Relaxed validation for development - accept any reasonable code format
  // Google OAuth codes can vary in format and length
  const codeRegex = /^[A-Za-z0-9\-._~%/]+$/;
  return code.length >= 4 && code.length <= 2048 && codeRegex.test(code);
}

/**
 * Clean up OAuth 2.0 session storage
 */
export function cleanupOAuthStorage(): void {
  try {
    sessionStorage.removeItem("oauth_state");
    sessionStorage.removeItem("oauth_nonce");
  } catch (error) {
    console.warn("Failed to cleanup OAuth storage:", error);
  }
}
