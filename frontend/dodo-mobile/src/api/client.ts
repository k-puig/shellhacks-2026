// Calls the DODO backend (backend/app/rest) as the signed-in user.
//
// Every backend reply is an envelope: { code, message, content }. Some routes
// send errors with HTTP 200 and the real status in `code`, so both are checked.

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

export function createApiClient(options: {
  baseUrl: string;
  // A current access token, or null when signed out.
  getToken: () => Promise<string | null>;
  // Called once the backend rejects the login, so the app can sign out.
  onUnauthorized: () => void;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): ApiClient {
  const { baseUrl, getToken, onUnauthorized, timeoutMs = 15_000, fetchImpl = fetch } = options;

  return async function request<T>(path: string, init: { method?: string; body?: unknown } = {}) {
    if (!baseUrl) throw new ApiError(0, 'The server address is not set up (EXPO_PUBLIC_API_URL).');

    const token = await getToken();
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (init.body !== undefined) headers['Content-Type'] = 'application/json';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetchImpl(`${baseUrl}/api/v1${path}`, {
        method: init.method ?? 'GET',
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: controller.signal,
      });
    } catch {
      throw new ApiError(0, "Couldn't reach the server. Check your connection and try again.");
    } finally {
      clearTimeout(timeout);
    }

    const body: unknown = await res.json().catch(() => null);
    const status = isEnvelope(body) && body.code >= 400 ? body.code : res.status;

    if (status === 401) {
      onUnauthorized();
      throw new ApiError(401, 'Your session has ended. Please log in again.');
    }
    if (status >= 400) {
      throw new ApiError(status, isEnvelope(body) ? body.message : `The server returned ${status}.`);
    }
    return (isEnvelope(body) ? body.content : body) as T;
  };
}
