import type { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { AuthRequest, AuthUser, Role } from './types.js';

const jwtSecret = process.env.JWT_SECRET ?? 'development-only-secret-change-me';

export function createToken(user: AuthUser): string {
  return jwt.sign(user, jwtSecret, { expiresIn: '12h' });
}

export function requireAuth(
  request: AuthRequest,
  response: Response,
  next: NextFunction,
): void {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) {
    response.status(401).json({ message: 'Anmeldung erforderlich.' });
    return;
  }

  try {
    request.user = jwt.verify(token, jwtSecret) as AuthUser;
    next();
  } catch {
    response.status(401).json({ message: 'Die Sitzung ist abgelaufen.' });
  }
}

export function allowRoles(...roles: Role[]) {
  return (request: AuthRequest, response: Response, next: NextFunction): void => {
    if (!request.user || !roles.includes(request.user.role)) {
      response.status(403).json({ message: 'Keine Berechtigung für diese Aktion.' });
      return;
    }
    next();
  };
}
