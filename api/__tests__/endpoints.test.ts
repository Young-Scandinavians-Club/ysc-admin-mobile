import { recordOfflineTicketOrder, subscribeOfflineMembership } from '@/api/endpoints';

describe('offline payment endpoints', () => {
  const config = { baseUrl: 'https://ysc-sandbox.fly.dev', token: 'test-token' };

  function mockJson(body: unknown) {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify(body),
      headers: new Headers({ 'content-type': 'application/json' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  }

  afterEach(() => {
    (global.fetch as jest.Mock | undefined)?.mockRestore?.();
  });

  it('subscribeOfflineMembership POSTs to the offline membership route with the body', async () => {
    const fetchMock = mockJson({
      id: 'sub_1',
      status: 'active',
      plan_id: 'single',
      plan_name: 'Single',
      current_period_end: null,
    });

    const res = await subscribeOfflineMembership(config, {
      member_id: 'm1',
      plan: 'single',
      payment_method: 'check',
      note: 'check #12',
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://ysc-sandbox.fly.dev/api/v1/app/memberships/subscribe_offline');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      member_id: 'm1',
      plan: 'single',
      payment_method: 'check',
      note: 'check #12',
    });
    expect(res.plan_id).toBe('single');
  });

  it('recordOfflineTicketOrder POSTs to the event-scoped offline order route', async () => {
    const fetchMock = mockJson({
      ticket_order_id: 'o1',
      ticket_order_reference: 'ORD-1',
      status: 'completed',
      ticket_count: 2,
      notes: 'Offline sale · method=cash',
    });

    const res = await recordOfflineTicketOrder(config, 'evt1', {
      member_id: 'm1',
      tiers: { t1: 2 },
      payment_method: 'cash',
      amount_collected_cents: 9000,
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://ysc-sandbox.fly.dev/api/v1/app/events/evt1/tickets/offline_order');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      member_id: 'm1',
      tiers: { t1: 2 },
      payment_method: 'cash',
      amount_collected_cents: 9000,
    });
    expect(res.ticket_count).toBe(2);
  });
});
