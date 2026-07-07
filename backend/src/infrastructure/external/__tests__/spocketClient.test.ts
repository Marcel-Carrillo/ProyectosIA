import { SpocketApiClient, SpocketApiError } from '../spocketClient';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('SpocketApiClient', () => {
  let client: SpocketApiClient;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new SpocketApiClient();
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  describe('verifyConnection', () => {
    it('should_return_healthy_true_when_upstream_responds_successfully', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { accountRef: 'acc-123' }));

      const result = await client.verifyConnection();

      expect(result).toEqual({ healthy: true, externalAccountRef: 'acc-123' });
    });

    it('should_return_healthy_false_without_throwing_when_authentication_is_rejected', async () => {
      fetchMock.mockResolvedValue(jsonResponse(401, {}));

      const result = await client.verifyConnection();

      expect(result).toEqual({ healthy: false });
    });

    it('should_send_an_authorization_header_without_asserting_on_the_key_value', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { accountRef: 'acc-123' }));

      await client.verifyConnection();

      const [, requestInit] = fetchMock.mock.calls[0];
      expect(requestInit.headers).toHaveProperty('Authorization');
      expect(String(requestInit.headers.Authorization)).toMatch(/^Bearer /);
    });
  });

  describe('fetchCatalog', () => {
    it('should_return_parsed_catalog_page_on_success', async () => {
      const page = { products: [], nextPageToken: null };
      fetchMock.mockResolvedValueOnce(jsonResponse(200, page));

      const result = await client.fetchCatalog();

      expect(result).toEqual(page);
    });

    it('should_throw_spocket_api_error_after_exhausting_retries_on_persistent_5xx', async () => {
      fetchMock.mockResolvedValue(jsonResponse(500, {}));

      await expect(client.fetchCatalog()).rejects.toBeInstanceOf(SpocketApiError);
      expect(fetchMock.mock.calls.length).toBe(4); // initial attempt + 3 retries
    }, 10000);

    it('should_succeed_after_a_retryable_429_recovers_before_exhausting_retries', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse(429, {}))
        .mockResolvedValueOnce(jsonResponse(200, { products: [], nextPageToken: null }));

      const result = await client.fetchCatalog();

      expect(result).toEqual({ products: [], nextPageToken: null });
      expect(fetchMock.mock.calls.length).toBe(2);
    });

    it('should_throw_spocket_api_error_when_fetch_rejects_repeatedly_network_failure', async () => {
      fetchMock.mockRejectedValue(new Error('network down'));

      await expect(client.fetchCatalog()).rejects.toBeInstanceOf(SpocketApiError);
    }, 10000);

    it('should_never_leak_response_body_content_into_the_thrown_error_message', async () => {
      // SpocketApiError.message is built only from statusCode + a fixed reason
      // string — it never reads the response body, so nothing the upstream
      // returns (which could echo request headers or other sensitive content)
      // can end up in a log line or API error response.
      fetchMock.mockResolvedValue(
        jsonResponse(500, { message: 'Bearer super-secret-key-value leaked' })
      );

      try {
        await client.fetchCatalog();
        fail('expected fetchCatalog to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(SpocketApiError);
        expect((err as Error).message).not.toContain('super-secret-key-value');
        expect((err as Error).message).not.toContain('Bearer');
      }
    }, 10000);
  });
});
