// Calls the DODO backend (backend/app/rest) as the signed-in user.
//
// Every backend reply is an envelope: { code, message, content }. Some routes
// send errors with HTTP 200 and the real status in `code`, so both are checked.

import { AUTH0_AUDIENCE } from '@/auth/config';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');

export const isApiConfigured = () => Boolean(API_URL);

// Its message is safe to show to the user as is.
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Envelope<T> = { code: number; message: string; content: T };

const isEnvelope = (body: unknown): body is Envelope<unknown> =>
  typeof body === 'object' &&
  body !== null &&
  typeof (body as Envelope<unknown>).code === 'number' &&
  typeof (body as Envelope<unknown>).message === 'string' &&
  'content' in body;

export type ApiClient = <T>(path: string, init?: { method?: string; body?: unknown }) => Promise<T>;

// Provisions the user after the backend verifies the same Auth0 API bearer token.
const LOGIN_PATH = '/user/mobile-login';

export function createApiClient(options: {
  baseUrl: string;
  // A current access token, or null when signed out.
  getToken: () => Promise<string | null>;
  audience?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): ApiClient {
  const { baseUrl, getToken, audience = AUTH0_AUDIENCE, timeoutMs = 15_000, fetchImpl = fetch } = options;

  async function send(path: string, init: { method?: string; body?: unknown }, token: string) {
    // File uploads go as multipart form data (fetch sets its own Content-Type).
    const isForm = typeof FormData !== 'undefined' && init.body instanceof FormData;
    const headers: Record<string, string> = { Accept: 'application/json' };
    headers.Authorization = `Bearer ${token}`;
    if (init.body !== undefined && !isForm) headers['Content-Type'] = 'application/json';

    const controller = new AbortController();
    // A book upload can take a while on a slow connection.
    const timeout = setTimeout(() => controller.abort(), isForm ? Math.max(timeoutMs, 120_000) : timeoutMs);
    let res: Response;
    try {
      res = await fetchImpl(`${baseUrl}/api/v1${path}`, {
        method: init.method ?? 'GET',
        headers,
        body: init.body === undefined ? undefined : isForm ? (init.body as FormData) : JSON.stringify(init.body),
        signal: controller.signal,
      });
    } catch {
      throw new ApiError(0, "Couldn't reach the server. Check your connection and try again.");
    } finally {
      clearTimeout(timeout);
    }

    const body: unknown = await res.json().catch(() => null);
    const status = isEnvelope(body) && body.code >= 400 ? body.code : res.status;
    return { status, body };
  }

  return async function request<T>(path: string, init: { method?: string; body?: unknown } = {}) {
    if (!baseUrl) throw new ApiError(0, 'The server address is not set up (EXPO_PUBLIC_API_URL).');
    if (!audience.trim()) {
      throw new ApiError(0, 'Set EXPO_PUBLIC_AUTH0_AUDIENCE to the backend Auth0 API identifier to sync.');
    }

    const token = await getToken();
    if (!token) throw new ApiError(401, 'Sign in to sync with your account.');

    let { status, body } = await send(path, init, token);

    // Provision only on an authenticated request's 401. A successful provision
    // isn't a cookie login: retry once with the same bearer, never recursively.
    if (status === 401 && path !== LOGIN_PATH) {
      const provision = await send(LOGIN_PATH, { method: 'POST' }, token);
      if (provision.status >= 400) {
        throw new ApiError(provision.status, isEnvelope(provision.body) ? provision.body.message : `The server returned ${provision.status}.`);
      }
      ({ status, body } = await send(path, init, token));
    }
    if (status >= 400) {
      throw new ApiError(status, isEnvelope(body) ? body.message : `The server returned ${status}.`);
    }
    return (isEnvelope(body) ? body.content : body) as T;
  };
}
