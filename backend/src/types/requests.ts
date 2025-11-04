import { Request } from "express";
import { AuthenticatedUser } from "./express";

// Extended Request interface with all Express properties
export interface AppRequest extends Omit<Request, 'ip'> {
  user?: AuthenticatedUser;
  csrfToken?(): string;
  ip: string; // Override ip to be required string instead of string | undefined
  // All other Express Request properties are inherited automatically
}