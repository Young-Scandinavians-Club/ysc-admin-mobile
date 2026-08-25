import { ApiClientError, request } from '@/api/client';

describe('request', () => {
  const config = { baseUrl: 'https://ysc-sandbox.fly.dev', token: 'test-token' };

  afterEach(() => {
    (global.fetch as jest.Mock | undefined)?.mockRestore?.();
  });

  it('attaches the bearer token and Accept header', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ ok: true }),
      headers: new Headers({ 'content-type': 'application/json' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await request(config, '/api/v1/app/events');

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer test-token');
    expect(init.headers.Accept).toBe('application/json');
  });

  it('skips the Authorization header when skipAuth is set', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ token: 'abc' }),
      headers: new Headers({ 'content-type': 'application/json' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await request(config, '/api/v1/app/auth/password', {
      method: 'POST',
      body: { email: 'a@b.com', password: 'x' },
      skipAuth: true,
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
    expect(init.body).toBe(JSON.stringify({ email: 'a@b.com', password: 'x' }));
  });

  it('throws ApiClientError with the parsed message on a non-2xx JSON response', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => JSON.stringify({ error: 'Invalid email or password' }),
      headers: new Headers({ 'content-type': 'application/json' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(request(config, '/api/v1/app/auth/password')).rejects.toMatchObject({
      message: 'Invalid email or password',
      status: 401,
    });
  });

  it('is an instance of ApiClientError', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => '',
      headers: new Headers(),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(request(config, '/api/v1/app/events')).rejects.toBeInstanceOf(ApiClientError);
  });
});
