import axios from 'axios';
import {
  cjConnectionService,
  mapCjConnectionError,
  extractCjConnectionErrorMessage,
  extractCjConnectionErrorCode,
} from '../cjConnectionService';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('mapCjConnectionError', () => {
  it.each([
    ['CJ_CONNECTION_NOT_FOUND', 'is configured'],
    ['CJ_CONNECTION_NOT_READY', 'not ready'],
    ['VALIDATION_ERROR', 'check the form fields'],
  ])('maps %s to a specific message', (code, fragment) => {
    expect(mapCjConnectionError(code)).toContain(fragment);
  });

  it('returns a generic fallback for unknown or empty codes', () => {
    expect(mapCjConnectionError('SOMETHING_ELSE')).toMatch(/unexpected error/i);
    expect(mapCjConnectionError('')).toMatch(/unexpected error/i);
  });

  it('maps HTTP 429 to a rate-limit message even with an empty code', () => {
    expect(mapCjConnectionError('', 429)).toMatch(/too many/i);
    expect(mapCjConnectionError('', 429)).toMatch(/try again/i);
  });
});

describe('cjConnectionService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('getConnection calls GET with the supplier-scoped connection path', async () => {
    mockedAxios.get.mockResolvedValue({
      data: { success: true, data: { id: 1, supplierId: 3, provider: 'CJDropshipping', status: 'Disconnected', externalAccountRef: null, lastVerifiedAt: null, lastSyncedAt: null, createdAt: '', updatedAt: '' }, message: '' },
    });

    await cjConnectionService.getConnection(3);

    expect(mockedAxios.get).toHaveBeenCalledWith('http://localhost:3000/api/admin/suppliers/3/cj/connection');
  });

  it('configureConnection calls POST with the payload', async () => {
    mockedAxios.post.mockResolvedValue({
      data: { success: true, data: { id: 1, supplierId: 3, provider: 'CJDropshipping', status: 'Disconnected', externalAccountRef: 'ref', lastVerifiedAt: null, lastSyncedAt: null, createdAt: '', updatedAt: '' }, message: '' },
    });

    await cjConnectionService.configureConnection(3, { externalAccountRef: 'ref' });

    expect(mockedAxios.post).toHaveBeenCalledWith('http://localhost:3000/api/admin/suppliers/3/cj/connection', {
      externalAccountRef: 'ref',
    });
  });

  it('verifyConnection calls POST to the verify endpoint with no body', async () => {
    mockedAxios.post.mockResolvedValue({ data: { success: true, data: { healthy: true }, message: '' } });

    await cjConnectionService.verifyConnection(3);

    expect(mockedAxios.post).toHaveBeenCalledWith('http://localhost:3000/api/admin/suppliers/3/cj/connection/verify');
  });

  it('sync calls POST to the sync endpoint with no body', async () => {
    mockedAxios.post.mockResolvedValue({
      data: { success: true, data: { itemsUpserted: 1, itemsFailed: 0, syncedAt: '2026-01-01T00:00:00.000Z' }, message: '' },
    });

    await cjConnectionService.sync(3);

    expect(mockedAxios.post).toHaveBeenCalledWith('http://localhost:3000/api/admin/suppliers/3/cj/sync');
  });

  it.each([
    ['getConnection', () => cjConnectionService.getConnection(3), () => mockedAxios.get.mockRejectedValue(new Error('boom'))],
    [
      'configureConnection',
      () => cjConnectionService.configureConnection(3, {}),
      () => mockedAxios.post.mockRejectedValue(new Error('boom')),
    ],
    ['verifyConnection', () => cjConnectionService.verifyConnection(3), () => mockedAxios.post.mockRejectedValue(new Error('boom'))],
    ['sync', () => cjConnectionService.sync(3), () => mockedAxios.post.mockRejectedValue(new Error('boom'))],
  ])('%s rethrows on failure', async (_name, call, arrange) => {
    arrange();
    await expect(call()).rejects.toThrow('boom');
  });
});

describe('extractCjConnectionErrorMessage / extractCjConnectionErrorCode', () => {
  it('extracts the mapped message and raw code from an axios error response', () => {
    const err = { response: { data: { error: { code: 'CJ_CONNECTION_NOT_READY' } } } };
    expect(extractCjConnectionErrorMessage(err)).toContain('not ready');
    expect(extractCjConnectionErrorCode(err)).toBe('CJ_CONNECTION_NOT_READY');
  });

  it('extracts the 429 rate-limit message from a real express-rate-limit response (plain-text body, no code)', () => {
    const err = { response: { status: 429, data: 'Too many requests, please try again later.' } };
    expect(extractCjConnectionErrorMessage(err)).toMatch(/too many/i);
    expect(extractCjConnectionErrorCode(err)).toBe('');
  });

  it('falls back gracefully when the error has no response', () => {
    const err = new Error('network down');
    expect(extractCjConnectionErrorMessage(err)).toMatch(/unexpected error/i);
    expect(extractCjConnectionErrorCode(err)).toBe('');
  });
});
