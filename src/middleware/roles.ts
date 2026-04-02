import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';

export function requireRole(role: 'elder' | 'caretaker' | Array<'elder' | 'caretaker'>) {
  const allowed = Array.isArray(role) ? role : [role];
  return async function (req: Request, res: Response, next: NextFunction) {
    const uid = (req as any).auth?.uid;
    if (!uid) return res.status(401).json({ ok: false, error: 'Unauthorized' });
    const user = await User.findOne({ uid });
    if (!user) return res.status(404).json({ ok: false, error: 'User not found' });
    if (!allowed.includes(user.role as any)) return res.status(403).json({ ok: false, error: 'Forbidden' });
    return next();
  };
}
