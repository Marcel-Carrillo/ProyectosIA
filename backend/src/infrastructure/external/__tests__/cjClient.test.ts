import type { CjApiClient as CjApiClientType, CjApiError as CjApiErrorType } from '../cjClient';

function envelopeResponse(status: number, body: Record<string, unknown>): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

const authSuccessBody = {
  code: 200,
  result: true,
  success: true,
  message: 'Success',
  data: {
    accessToken: 'token-1',
    accessTokenExpiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(), // 30 days out
    refreshToken: 'refresh-1',
    refreshTokenExpiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 180).toISOString(),
  },
  pointsInfo: { total: 100, usedToday: 1, remaining: 99 },
};

describe('CjApiClient', () => {
  let client: CjApiClientType;
  let CjApiError: typeof CjApiErrorType;
  let fetchMock: jest.Mock;

  beforeEach(async () => {
    // The client caches its auth token as module-level state (by design — a
    // single global CJ account, not per-supplier). jest.clearAllMocks() does
    // NOT reset that module state, so each test must get a fresh module
    // instance via jest.resetModules() to avoid a cached token from one test
    // leaking into the next and swallowing the next test's mocked auth call.
    jest.resetModules();
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    const mod = await import('../cjClient');
    client = new mod.CjApiClient();
    CjApiError = mod.CjApiError;
  });

  describe('verifyConnection', () => {
    it('should_return_healthy_true_when_auth_and_settings_both_succeed', async () => {
      fetchMock
        .mockResolvedValueOnce(envelopeResponse(200, authSuccessBody))
        .mockResolvedValueOnce(envelopeResponse(200, { code: 200, result: true, success: true, data: { isSandbox: 0 } }));

      const result = await client.verifyConnection();

      expect(result).toEqual({ healthy: true });
    });

    it('should_return_healthy_false_without_throwing_when_body_success_is_false_despite_http_200', async () => {
      // Critical regression: CJ returns HTTP 200 even for logical errors —
      // success/failure must be read from the body, not the status code.
      fetchMock.mockResolvedValue(
        envelopeResponse(200, { code: 1000, result: false, success: false, message: 'invalid apiKey', data: null })
      );

      const result = await client.verifyConnection();

      expect(result).toEqual({ healthy: false });
    });
  });

  describe('token caching and refresh', () => {
    it('should_reuse_a_cached_token_when_not_near_expiry', async () => {
      fetchMock
        .mockResolvedValueOnce(envelopeResponse(200, authSuccessBody))
        .mockResolvedValueOnce(envelopeResponse(200, { code: 200, result: true, success: true, data: [] }))
        .mockResolvedValueOnce(envelopeResponse(200, { code: 200, result: true, success: true, data: [] }));

      await client.fetchCategories();
      await client.fetchCategories();

      const authCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes('getAccessToken'));
      expect(authCalls.length).toBe(1);
    });

    it('should_refresh_the_token_when_accessTokenExpiryDate_is_within_the_safety_margin', async () => {
      const soonToExpireAuth = {
        ...authSuccessBody,
        data: { ...authSuccessBody.data, accessTokenExpiryDate: new Date(Date.now() + 1000 * 60).toISOString() },
      };
      fetchMock
        .mockResolvedValueOnce(envelopeResponse(200, soonToExpireAuth))
        .mockResolvedValueOnce(envelopeResponse(200, { code: 200, result: true, success: true, data: [] }))
        .mockResolvedValueOnce(envelopeResponse(200, authSuccessBody)) // refreshAccessToken response
        .mockResolvedValueOnce(envelopeResponse(200, { code: 200, result: true, success: true, data: [] }));

      await client.fetchCategories();
      await client.fetchCategories();

      const refreshCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes('refreshAccessToken'));
      expect(refreshCalls.length).toBe(1);
    });
  });

  describe('fetchCatalog / calculateFreight / createOrder / getOrderDetail', () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(envelopeResponse(200, authSuccessBody));
    });

    it('should_return_parsed_catalog_page_on_success', async () => {
      const page = { pageSize: 20, pageNumber: 1, totalRecords: 0, totalPages: 0, content: [] };
      fetchMock.mockResolvedValueOnce(envelopeResponse(200, { code: 200, result: true, success: true, data: page }));

      const result = await client.fetchCatalog(1);

      expect(result).toEqual(page);
    });

    it('should_return_freight_options_on_success', async () => {
      const options = [{ logisticName: 'CJPacket Ordinary', logisticAging: '4-8', logisticPrice: 8.95, totalPostageFee: 7.31 }];
      fetchMock.mockResolvedValueOnce(envelopeResponse(200, { code: 200, result: true, success: true, data: options }));

      const result = await client.calculateFreight({ startCountryCode: 'CN', endCountryCode: 'ES', products: [{ vid: 'v1', quantity: 1 }] });

      expect(result).toEqual(options);
    });

    it('should_always_send_isSandbox_1_on_createOrder_regardless_of_extra_params', async () => {
      fetchMock.mockResolvedValueOnce(
        envelopeResponse(200, { code: 200, result: true, success: true, data: { orderId: 'cj-order-1' } })
      );

      const params = {
        orderNumber: 'SPO-000001',
        logisticName: 'CJPacket Ordinary',
        fromCountryCode: 'CN',
        products: [{ vid: 'v1', quantity: 1 }],
        shippingCustomerName: 'Jane',
        shippingPhone: '+34600000000',
        shippingAddress: 'Main St 1',
        shippingCity: 'Malaga',
        shippingProvince: 'Malaga',
        shippingZip: '29001',
        shippingCountry: 'Spain',
        shippingCountryCode: 'ES',
        isSandbox: 0,
      } as unknown as Omit<import('../cjTypes').CjOrderCreateParams, 'isSandbox'>;
      const result = await client.createOrder(params);

      expect(result).toEqual({ orderId: 'cj-order-1' });
      const [, requestInit] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
      const sentBody = JSON.parse(requestInit.body as string);
      expect(sentBody.isSandbox).toBe(1);
      expect(sentBody.shopLogisticsType).toBe(2);
    });

    it('should_return_order_detail_on_success', async () => {
      const detail = { orderId: 'cj-order-1', orderStatus: 'PROCESSING', trackNumber: null, logisticName: 'CJPacket Ordinary' };
      fetchMock.mockResolvedValueOnce(envelopeResponse(200, { code: 200, result: true, success: true, data: detail }));

      const result = await client.getOrderDetail('cj-order-1');

      expect(result).toEqual(detail);
    });
  });

  describe('simulateSandboxAdvance', () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(envelopeResponse(200, authSuccessBody));
    });

    it('should_call_simulatePay_then_updateStatus_400_then_500_in_order', async () => {
      fetchMock
        .mockResolvedValueOnce(envelopeResponse(200, { code: 200, result: true, success: true, data: true }))
        .mockResolvedValueOnce(envelopeResponse(200, { code: 200, result: true, success: true, data: true }))
        .mockResolvedValueOnce(envelopeResponse(200, { code: 200, result: true, success: true, data: true }));

      await client.simulateSandboxAdvance('cj-order-1');

      const calledPaths = fetchMock.mock.calls
        .filter(([url]) => !String(url).includes('getAccessToken'))
        .map(([url]) => String(url));
      expect(calledPaths).toEqual([
        expect.stringContaining('/shopping/sandbox/simulatePay'),
        expect.stringContaining('/shopping/sandbox/updateStatus'),
        expect.stringContaining('/shopping/sandbox/updateStatus'),
      ]);
      const updateStatusBodies = fetchMock.mock.calls
        .filter(([url]) => String(url).includes('updateStatus'))
        .map(([, init]) => JSON.parse((init as RequestInit).body as string));
      expect(updateStatusBodies).toEqual([
        { orderId: 'cj-order-1', targetStatus: 400 },
        { orderId: 'cj-order-1', targetStatus: 500 },
      ]);
    });

    it('should_not_throw_and_should_still_attempt_later_steps_when_a_step_is_a_logical_failure', async () => {
      // e.g. simulatePay rejected because the order is still at IN_CART —
      // an expected, non-exceptional outcome for a best-effort QA helper.
      fetchMock
        .mockResolvedValueOnce(
          envelopeResponse(200, { code: 812, result: false, success: false, message: 'not UNPAID', data: null })
        )
        .mockResolvedValueOnce(
          envelopeResponse(200, { code: 816, result: false, success: false, message: 'invalid transition', data: null })
        )
        .mockResolvedValueOnce(envelopeResponse(200, { code: 200, result: true, success: true, data: true }));

      await expect(client.simulateSandboxAdvance('cj-order-1')).resolves.toBeUndefined();
    });

    it('should_throw_CjApiError_on_auth_rejection_and_not_attempt_further_steps', async () => {
      fetchMock.mockResolvedValueOnce(envelopeResponse(403, { code: 403, result: false, success: false, data: null }));

      await expect(client.simulateSandboxAdvance('cj-order-1')).rejects.toBeInstanceOf(CjApiError);
      const nonAuthCalls = fetchMock.mock.calls.filter(([url]) => !String(url).includes('getAccessToken'));
      expect(nonAuthCalls.length).toBe(1);
    });
  });

  describe('error handling and retries', () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(envelopeResponse(200, authSuccessBody));
    });

    it('should_throw_CjApiError_after_exhausting_retries_on_persistent_5xx', async () => {
      fetchMock.mockResolvedValue(envelopeResponse(500, { code: 500, result: false, success: false, data: null }));

      await expect(client.fetchCategories()).rejects.toBeInstanceOf(CjApiError);
    }, 10000);

    it('should_succeed_after_a_retryable_429_recovers_before_exhausting_retries', async () => {
      fetchMock
        .mockResolvedValueOnce(envelopeResponse(429, { code: 429, result: false, success: false, data: null }))
        .mockResolvedValueOnce(envelopeResponse(200, { code: 200, result: true, success: true, data: [] }));

      const result = await client.fetchCategories();

      expect(result).toEqual([]);
    });

    it('should_never_leak_response_body_content_into_the_thrown_error_message_or_the_logs', async () => {
      const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
      fetchMock.mockResolvedValue(
        envelopeResponse(500, { code: 500, result: false, success: false, message: 'Bearer super-secret-leak', data: null })
      );

      try {
        await client.fetchCategories();
        fail('expected fetchCategories to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(CjApiError);
        expect((err as Error).message).not.toContain('super-secret-leak');
      } finally {
        const loggedOutput = writeSpy.mock.calls.map((call) => String(call[0])).join('\n');
        expect(loggedOutput).not.toContain('super-secret-leak');
        writeSpy.mockRestore();
      }
    }, 10000);
  });
});
