import { getConfig, handleWebhook } from '../paymentController';
import { PaymentWebhookSignatureInvalidError } from '../../../application/validator';
import { Request, Response, NextFunction } from 'express';

const mockGetConfig = jest.fn();
const mockHandleWebhookEvent = jest.fn();

jest.mock('../../../application/services/paymentService', () => ({
  paymentService: {
    getConfig: (...args: unknown[]) => mockGetConfig(...args),
    handleWebhookEvent: (...args: unknown[]) => mockHandleWebhookEvent(...args),
  },
}));

function makeMocks() {
  const req = {
    headers: {} as Record<string, string>,
    body: Buffer.from('{}') as unknown,
  } as Request;
  const res = {
    json: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
  } as unknown as Response;
  const next = jest.fn() as NextFunction;
  return { req, res, next };
}

describe('getConfig', () => {
  it('returns 200 with publishableKey and mode', async () => {
    const { req, res, next } = makeMocks();
    mockGetConfig.mockReturnValue({ publishableKey: 'pk_test_abc', mode: 'test' });
    await getConfig(req, res, next);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { publishableKey: 'pk_test_abc', mode: 'test' },
    });
  });

  it('response body does NOT contain any sk_ string', async () => {
    const { req, res, next } = makeMocks();
    mockGetConfig.mockReturnValue({ publishableKey: 'pk_test_abc', mode: 'test' });
    await getConfig(req, res, next);
    const call = (res.json as jest.Mock).mock.calls[0][0];
    const json = JSON.stringify(call);
    expect(json).not.toContain('sk_');
  });

  it('calls next on error', async () => {
    const { req, res, next } = makeMocks();
    const err = new Error('config error');
    mockGetConfig.mockImplementation(() => { throw err; });
    await getConfig(req, res, next);
    expect(next).toHaveBeenCalledWith(err);
  });
});

describe('handleWebhook', () => {
  it('returns 400 when Stripe-Signature header is missing', async () => {
    const { req, res, next } = makeMocks();
    req.headers = {};
    await handleWebhook(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });

  it('returns 400 when handleWebhookEvent throws PaymentWebhookSignatureInvalidError', async () => {
    const { req, res, next } = makeMocks();
    req.headers = { 'stripe-signature': 'bad_sig' } as unknown as typeof req.headers;
    mockHandleWebhookEvent.mockRejectedValue(new PaymentWebhookSignatureInvalidError());
    await handleWebhook(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 200 when handleWebhookEvent succeeds', async () => {
    const { req, res, next } = makeMocks();
    req.headers = { 'stripe-signature': 'valid_sig' } as unknown as typeof req.headers;
    mockHandleWebhookEvent.mockResolvedValue(undefined);
    await handleWebhook(req, res, next);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('calls next(err) for non-signature errors', async () => {
    const { req, res, next } = makeMocks();
    req.headers = { 'stripe-signature': 'sig' } as unknown as typeof req.headers;
    const err = new Error('unexpected');
    mockHandleWebhookEvent.mockRejectedValue(err);
    await handleWebhook(req, res, next);
    expect(next).toHaveBeenCalledWith(err);
  });
});
