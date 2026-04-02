import { Request, Response, NextFunction } from 'express';
import { AuditLog } from '../models/AuditLog';

// Audit requests for sensitive paths
export function auditMiddleware(req: Request, res: Response, next: NextFunction) {
  const pathsToAudit = ['/api/auth', '/api/link', '/api/medicines', '/api/notifications'];
  const shouldAudit = pathsToAudit.some((p) => req.path.startsWith(p));
  if (!shouldAudit) return next();

  const start = Date.now();
  const uid = (req as any).auth?.uid;
  const ip = req.ip;
  const body = req.body;

  res.on('finish', async () => {
    try {
      const status = res.statusCode;
      await AuditLog.create({ uid, ip, method: req.method, path: req.path, body, status });
    } catch (err) {
      // do not block request on audit failure
      console.error('Audit log failed', err);
    }
  });

  next();
}
