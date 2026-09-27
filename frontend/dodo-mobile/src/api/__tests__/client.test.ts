import { ApiError, createApiClient } from '../client';

const reply = (status: number, body: unknown) =>
  ({ status, json: async () => body }) as unknown as Response;

function setup(response: Response | Error, token: string | null = 'token-1') {
  const fetchImpl = jest.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  const onUnauthorized = jest.fn();
  const api = createApiClient({
    baseUrl: 'https://dodo.test',
    getToken: async () => token,
    onUnauthorized,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  return { api, fetchImpl, onUnauthorized };
}

describe('createApiClient', () => {
  it('sends the login token and returns the envelope content', async () => {
    const { api, fetchImpl } = setup(reply(200, { code: 200, message: 'ok', content: [{ id: 'b1' }] }));

    await expect(api('/book')).resolves.toEqual([{ id: 'b1' }]);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://dodo.test/api/v1/book');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token-1');
  });

  it('sends a JSON body', async () => {
    const { api, fetchImpl } = setup(reply(201, { code: 201, message: 'created', content: { id: 'n1' } }));

    await api('/note', { method: 'POST', body: { text: 'hi' } });
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"text":"hi"}');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('leaves out the header when signed out', async () => {
    const { api, fetchImpl } = setup(reply(200, { code: 200, message: 'ok', content: null }), null);

    await api('/book');
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('signs out on a 401', async () => {
    const { api, onUnauthorized } = setup(reply(401, null));

    await expect(api('/book')).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('treats an error code inside a 200 reply as the real status', async () => {
    const { api, onUnauthorized } = setup(reply(200, { code: 400, message: 'Invalid book id', content: [] }));

    await expect(api('/book/x')).rejects.toEqual(new ApiError(400, 'Invalid book id'));
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('reports an unreachable server clearly', async () => {
    const { api } = setup(new TypeError('Network request failed'));

    await expect(api('/book')).rejects.toMatchObject({ status: 0 });
  });
});

describe('backend login', () => {
  it('logs into the backend once on a 401, then retries', async () => {
    const replies = [
      reply(401, { code: 401, message: 'Not logged in', content: null }),
      reply(200, { code: 200, message: 'ok', content: { id: 'u1' } }),
      reply(200, { code: 200, message: 'ok', content: ['book'] }),
    ];
    const fetchImpl = jest.fn(async () => replies.shift() as Response);
    const onUnauthorized = jest.fn();
    const api = createApiClient({
      baseUrl: 'https://dodo.test',
      getToken: async () => 'token-1',
      onUnauthorized,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(api('/book')).resolves.toEqual(['book']);
    const calls = fetchImpl.mock.calls as unknown as [string, RequestInit][];
    expect(calls.map(([url, init]) => `${init.method} ${url}`)).toEqual([
      'GET https://dodo.test/api/v1/book',
      'POST https://dodo.test/api/v1/user/mobile-login',
      'GET https://dodo.test/api/v1/book',
    ]);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});

describe('file uploads', () => {
  it('sends form data as is, without a JSON content type', async () => {
    const { api, fetchImpl } = setup(reply(201, { code: 201, message: 'created', content: { id: 'b1' } }));
    const form = new FormData();
    form.append('title', 'Frankenstein');

    await api('/book', { method: 'POST', body: form });
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.body).toBe(form);
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });
});
