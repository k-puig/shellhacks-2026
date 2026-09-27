import { ApiError, createApiClient } from '../client';

const reply = (status: number, body: unknown) =>
  ({ status, json: async () => body }) as unknown as Response;

function setup(responses: (Response | Error)[], token: string | null = 'token-1') {
  const fetchImpl = jest.fn(async (_url: string, _init: RequestInit) => {
    const response = responses.shift();
    if (response instanceof Error) throw response;
    if (!response) throw new Error('Unexpected fetch');
    return response;
  });
  const getToken = jest.fn(async () => token);
  const api = createApiClient({
    baseUrl: 'https://dodo.test',
    audience: 'https://dodo.test/api',
    getToken,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  return { api, fetchImpl, getToken };
}

const ok = (content: unknown) => reply(200, { code: 200, message: 'ok', content });

it('sends the API bearer without cookies and unwraps the envelope', async () => {
  const { api, fetchImpl } = setup([ok([{ id: 'b1' }])]);
  await expect(api('/book')).resolves.toEqual([{ id: 'b1' }]);
  const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe('https://dodo.test/api/v1/book');
  expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token-1');
  expect(init.credentials).toBeUndefined();
});

it('sends JSON and form data with the correct content types', async () => {
  const { api, fetchImpl } = setup([ok(null), ok(null)]);
  await api('/note', { method: 'POST', body: { text: 'hi' } });
  const form = new FormData();
  form.append('title', 'Frankenstein');
  await api('/book', { method: 'POST', body: form });
  const json = fetchImpl.mock.calls[0][1] as RequestInit;
  const upload = fetchImpl.mock.calls[1][1] as RequestInit;
  expect(json.body).toBe('{"text":"hi"}');
  expect((json.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  expect(upload.body).toBe(form);
  expect((upload.headers as Record<string, string>)['Content-Type']).toBeUndefined();
});

it('rejects a missing or whitespace-only audience before getting a token or sending a request', async () => {
  const { fetchImpl, getToken } = setup([]);
  for (const audience of ['', '   ']) {
    const api = createApiClient({
      baseUrl: 'https://dodo.test',
      audience,
      getToken,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await expect(api('/book')).rejects.toEqual(
      new ApiError(0, 'Set EXPO_PUBLIC_AUTH0_AUDIENCE to the backend Auth0 API identifier to sync.'),
    );
  }
  expect(getToken).not.toHaveBeenCalled();
  expect(fetchImpl).not.toHaveBeenCalled();
});

it('keeps the API optional when no server address is configured', async () => {
  const { fetchImpl, getToken } = setup([]);
  const api = createApiClient({
    baseUrl: '',
    audience: '',
    getToken,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  await expect(api('/book')).rejects.toEqual(new ApiError(0, 'The server address is not set up (EXPO_PUBLIC_API_URL).'));
  expect(getToken).not.toHaveBeenCalled();
  expect(fetchImpl).not.toHaveBeenCalled();
});

it('does not call the backend without a token', async () => {
  const { api, fetchImpl } = setup([], null);
  await expect(api('/book')).rejects.toEqual(new ApiError(401, 'Sign in to sync with your account.'));
  expect(fetchImpl).not.toHaveBeenCalled();
});

it('provisions with the bearer after a 401 and retries only once', async () => {
  const { api, fetchImpl, getToken } = setup([
    reply(401, { code: 401, message: 'Not provisioned', content: null }),
    ok({ id: 'u1' }),
    ok(['book']),
  ]);
  await expect(api('/book')).resolves.toEqual(['book']);
  const calls = fetchImpl.mock.calls as unknown as [string, RequestInit][];
  expect(calls.map(([url, init]) => `${init.method} ${url}`)).toEqual([
    'GET https://dodo.test/api/v1/book',
    'POST https://dodo.test/api/v1/user/mobile-login',
    'GET https://dodo.test/api/v1/book',
  ]);
  expect(calls.every(([, init]) => (init.headers as Record<string, string>).Authorization === 'Bearer token-1')).toBe(true);
  expect(getToken).toHaveBeenCalledTimes(1);
});

it('never recursively provisions and surfaces an unrelated 401', async () => {
  const { api, fetchImpl } = setup([reply(401, null), ok(null), reply(401, null)]);
  await expect(api('/book')).rejects.toMatchObject({ status: 401 });
  expect(fetchImpl).toHaveBeenCalledTimes(3);
});

it('does not retry provisioning itself or retry when provisioning fails', async () => {
  const direct = setup([reply(401, null)]);
  await expect(direct.api('/user/mobile-login', { method: 'POST' })).rejects.toMatchObject({ status: 401 });
  expect(direct.fetchImpl).toHaveBeenCalledTimes(1);
  const failed = setup([reply(401, null), reply(403, { code: 403, message: 'Forbidden', content: null })]);
  await expect(failed.api('/book')).rejects.toEqual(new ApiError(403, 'Forbidden'));
  expect(failed.fetchImpl).toHaveBeenCalledTimes(2);
});

it('uses the envelope error code and reports network errors', async () => {
  const { api } = setup([reply(200, { code: 400, message: 'Invalid book id', content: [] }), new TypeError('Network request failed')]);
  await expect(api('/book/x')).rejects.toEqual(new ApiError(400, 'Invalid book id'));
  await expect(api('/book')).rejects.toMatchObject({ status: 0 });
});
