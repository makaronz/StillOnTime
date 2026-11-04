import express, { NextFunction, Response } from "express";
import cookieParser from "cookie-parser";
import csrf from "csurf";

/**
 * CSRF wiring for the main app (extracted from index.ts so it can be tested).
 *
 * csurf is used in cookie mode, which REQUIRES cookie-parser to be mounted
 * first. Without it every protected request fails with
 * `500 misconfigured csrf` instead of validating the token.
 */

// Exact paths that are authenticated by other means and so cannot carry a
// browser CSRF token.
//  - /api/auth/callback: OAuth redirect from Google (validated via `state`)
//  - /api/sms/webhook:   Twilio server-to-server callback (validated via
//                        X-Twilio-Signature in SMSController.handleWebhook)
const CSRF_EXEMPT_PATHS: ReadonlySet<string> = new Set([
  "/api/auth/callback",
  "/api/sms/webhook",
]);

const SAFE_METHODS: ReadonlySet<string> = new Set(["GET", "HEAD", "OPTIONS"]);

export function shouldSkipCsrf(
  req: { method: string; path: string },
  nodeEnv: string
): boolean {
  if (SAFE_METHODS.has(req.method)) return true;
  if (req.path === "/health" || req.path.startsWith("/health/")) return true;
  if (CSRF_EXEMPT_PATHS.has(req.path)) return true;
  // Development convenience kept from the original implementation.
  if (nodeEnv === "development" && req.path.startsWith("/api/")) return true;
  return false;
}

export function installCsrf(
  app: express.Application,
  options: { nodeEnv: string }
): void {
  const { nodeEnv } = options;
  const isProduction = nodeEnv === "production";

  const csrfProtection = csrf({
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict",
      key: "_csrf",
    },
  });

  // Required by csurf's cookie mode.
  app.use(cookieParser());

  app.use((req: any, res: Response, next: NextFunction) => {
    if (shouldSkipCsrf(req, nodeEnv)) {
      return next();
    }
    (csrfProtection as any)(req, res, next);
  });

  // Token endpoint - provides token to the frontend
  app.get("/api/csrf-token", (req: any, res: Response, next: NextFunction) => {
    (csrfProtection as any)(req, res, (err: unknown) => {
      if (err) return next(err);
      res.json({ csrfToken: req.csrfToken() });
    });
  });

  // Mirror the token into a readable cookie for the frontend when available.
  app.use((req: any, res: Response, next: NextFunction) => {
    if (req.csrfToken) {
      res.cookie("XSRF-TOKEN", req.csrfToken(), {
        httpOnly: false, // Frontend needs to read this
        secure: isProduction,
        sameSite: "strict",
      });
    }
    next();
  });
}
