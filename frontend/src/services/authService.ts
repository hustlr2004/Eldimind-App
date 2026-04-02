import { getFrontendIdToken } from './firebaseClient';
import { fetchJson, postJson } from './apiClient';
import type { AppUser } from '../types';

type SessionLoginResponse = {
  ok: boolean;
  uid: string;
  user: AppUser;
};

export async function loginWithBackendSession(input: {
  role: 'elder' | 'caretaker';
  fullName: string;
  email?: string;
  phone?: string;
  rememberMe?: boolean;
}) {
  const idToken = await getFrontendIdToken(input.fullName, input.role);
  const response = await postJson<SessionLoginResponse>('/api/auth/session-login', {
    idToken,
    rememberMe: input.rememberMe,
    profile: {
      fullName: input.fullName,
      role: input.role,
      email: input.email,
      phone: input.phone,
    },
  });

  return response.user;
}

export async function readCurrentUser() {
  const response = await fetchJson<{ ok: boolean; user: AppUser }>('/api/auth/me');
  return response.user;
}

export async function logoutFromBackend() {
  await postJson('/api/auth/logout', {});
}
