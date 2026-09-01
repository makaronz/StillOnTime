
// Define the authenticated user interface
export interface AuthenticatedUser {
  userId: string;
  email: string;
  name?: string;
  role?: string;
  tier?: string;
  fingerprint?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};