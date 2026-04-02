const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
      ...init,
    });
  } catch {
    throw new Error('Backend is unreachable right now. Please make sure the EldiMind server is running on port 4000.');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data as T;
}

export function fetchJson<T>(path: string) {
  return request<T>(path);
}

export function postJson<T>(path: string, body: unknown) {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body) });
}

export function patchJson<T>(path: string, body: unknown) {
  return request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
}

export function deleteJson<T>(path: string) {
  return request<T>(path, { method: 'DELETE' });
}

export function buildApiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

export { API_BASE_URL };
