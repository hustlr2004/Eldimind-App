import crypto from 'crypto';

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'eldimind_session';
const SESSION_SECRET = process.env.JWT_SECRET || 'change-me';
const REMEMBER_ME_DAYS = Number(process.env.SESSION_REMEMBER_ME_DAYS || 30);
const DEFAULT_HOURS = Number(process.env.SESSION_DEFAULT_HOURS || 12);

type SessionPayload = {
  uid: string;
  email?: string;
  exp: number;
};

function base64urlEncode(input: string) {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function base64urlDecode(input: string) {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function sign(value: string) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('base64url');
}

export function getSessionCookieName() {
  return SESSION_COOKIE_NAME;
}

export function getSessionMaxAgeMs(rememberMe?: boolean) {
  return (rememberMe ? REMEMBER_ME_DAYS * 24 : DEFAULT_HOURS) * 60 * 60 * 1000;
}

export function createSessionToken(input: { uid: string; email?: string; rememberMe?: boolean }) {
  const exp = Date.now() + getSessionMaxAgeMs(input.rememberMe);
  const payload: SessionPayload = { uid: input.uid, email: input.email, exp };
  const encodedPayload = base64urlEncode(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifySessionToken(token?: string | null) {
  if (!token) return null;
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature || sign(encodedPayload) !== signature) return null;

  try {
    const payload = JSON.parse(base64urlDecode(encodedPayload)) as SessionPayload;
    if (!payload.uid || !payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
