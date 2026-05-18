import { Request } from 'express';

export interface AuthUser {
  id: string;
  role: string;
  email: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}
