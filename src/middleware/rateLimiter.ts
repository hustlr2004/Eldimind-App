import rateLimit from 'express-rate-limit';

function isLocalRequest(ip?: string) {
  if (!ip) return false;
  return ip === '127.0.0.1' || ip === '::1' || ip.includes('127.0.0.1') || ip.includes('::1');
}

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 200 : 5000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV !== 'production' && isLocalRequest(req.ip),
  message: { ok: false, error: 'Too many requests, please wait a moment.' },
});

// OTP generation limiter: stricter to prevent abuse
export const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, // max 5 OTPs per IP per window
  message: { ok: false, error: 'Too many OTP requests, try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV !== 'production' && isLocalRequest(req.ip),
});

// AI usage limiter: avoid abuse of the Gemini proxy
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 AI requests per IP per minute
  message: { ok: false, error: 'AI rate limit exceeded, slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV !== 'production' && isLocalRequest(req.ip),
});
