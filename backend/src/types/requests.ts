import { Request } from "express";
import { AuthenticatedUser } from "./express";

// Extended Request interface with all Express properties
export interface AppRequest extends Request {
  user?: AuthenticatedUser;
  csrfToken?(): string;
  // Ensure all Express Request properties are available
  query: any;
  params: any;
  ip: string;
  get(name: string): string | undefined;
  body: any;
  path: string;
  method: string;
  headers: any;
  cookies: any;
  url: string;
  originalUrl: string;
  baseUrl: string;
  connection: any;
  route: any;
}