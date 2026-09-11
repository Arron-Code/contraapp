import type { Request } from 'express';

export type Role = 'OWNER' | 'ADMIN' | 'MANAGER' | 'ACCOUNTING' | 'VIEWER';

export interface AuthUser {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: Role;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}
