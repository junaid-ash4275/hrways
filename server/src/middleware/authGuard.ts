import type { NextFunction, Request, Response } from 'express';
import { verify } from 'jsonwebtoken';
import { env } from '../config/env';

type Role = 'ADMIN' | 'HR';

export function authGuard(requiredRole?: Role) {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = req.headers['authorization'];
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing or invalid token' } });
    }
    const token = auth.slice('Bearer '.length);
    try {
      const payload = verify(token, env.JWT_ACCESS_SECRET) as any;
      (req as any).user = { id: payload.sub, role: payload.role as Role };
      if (requiredRole) {
        const current: Role = payload.role;
        const allowed = requiredRole === 'HR' ? (current === 'HR' || current === 'ADMIN') : (current === 'ADMIN');
        if (!allowed) {
          return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient role' } });
        }
      }
      next();
    } catch (e) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } });
    }
  };
}
