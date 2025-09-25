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
  if (!receivedState || !storedState) {
    return false;
  }

  // Use constant-time comparison to prevent timing attacks
  if (receivedState.length !== storedState.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < receivedState.length; i++) {
    result |= receivedState.charCodeAt(i) ^ storedState.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Validate OAuth 2.0 authorization code format
 */
export function validateAuthCode(code: string): boolean {
  if (!code || typeof code !== "string") {
    return false;
  }

  // Basic validation - code should be at least 10 characters and contain only valid characters
  const codeRegex = /^[A-Za-z0-9\-._~]+$/;
  return code.length >= 10 && code.length <= 512 && codeRegex.test(code);
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
