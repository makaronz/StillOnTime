/**
 * CSRF Token Management Utility
 * Handles CSRF token retrieval and inclusion in API requests
 */

/**
 * Get CSRF token from cookie
 * The backend sets this in the XSRF-TOKEN cookie
 */
export const getCsrfTokenFromCookie = (): string | null => {
  const name = "XSRF-TOKEN=";
  const decodedCookie = decodeURIComponent(document.cookie);
  const cookieArray = decodedCookie.split(";");

  for (let i = 0; i < cookieArray.length; i++) {
    let cookie = cookieArray[i].trim();
    if (cookie.indexOf(name) === 0) {
      return cookie.substring(name.length, cookie.length);
    }
  }

  return null;
};

/**
 * Fetch CSRF token from backend
 * Call this on app initialization or when token is missing
 */
export const fetchCsrfToken = async (): Promise<string | null> => {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3001"}/api/csrf-token`, {
      method: "GET",
      credentials: "include", // Important: include cookies
    });

    if (!response.ok) {
      console.error("Failed to fetch CSRF token:", response.statusText);
      return null;
    }

    const data = await response.json();
    return data.csrfToken;
  } catch (error) {
    console.error("Error fetching CSRF token:", error);
    return null;
  }
};

/**
 * Get CSRF token - tries cookie first, then fetches from backend if needed
 */
export const getCsrfToken = async (): Promise<string | null> => {
  // Try to get from cookie first
  let token = getCsrfTokenFromCookie();

  // If not in cookie, fetch from backend
  if (!token) {
    token = await fetchCsrfToken();
  }

  return token;
};

/**
 * Add CSRF token to request headers
 * Use this utility in your API service functions
 */
export const addCsrfTokenToHeaders = async (
  headers: Record<string, string> = {}
): Promise<Record<string, string>> => {
  const token = await getCsrfToken();

  if (token) {
    headers["X-CSRF-Token"] = token;
    headers["X-XSRF-TOKEN"] = token; // Some libraries expect this header name
  }

  return headers;
};

/**
 * Initialize CSRF protection on app startup
 * Call this in your main App component or index file
 */
export const initializeCsrfProtection = async (): Promise<void> => {
  try {
    await fetchCsrfToken();
    console.log("CSRF protection initialized");
  } catch (error) {
    console.error("Failed to initialize CSRF protection:", error);
  }
};

