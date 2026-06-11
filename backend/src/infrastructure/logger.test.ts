import { logger } from './logger';

describe('logger', () => {
  let stdoutSpy: jest.SpyInstance;
  let stderrSpy: jest.SpyInstance;

  beforeEach(() => {
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it('info writes a JSON entry with level "info" to stdout', () => {
    logger.info('hello');
    const raw = stdoutSpy.mock.calls[0][0] as string;
    const entry = JSON.parse(raw);
    expect(entry.level).toBe('info');
    expect(entry.message).toBe('hello');
    expect(entry.timestamp).toBeDefined();
  });

  it('warn writes a JSON entry with level "warn" to stdout', () => {
    logger.warn('watch out');
    const raw = stdoutSpy.mock.calls[0][0] as string;
    const entry = JSON.parse(raw);
    expect(entry.level).toBe('warn');
  });

  it('error writes a JSON entry with level "error" to stderr', () => {
    logger.error('something broke');
    const raw = stderrSpy.mock.calls[0][0] as string;
    const entry = JSON.parse(raw);
    expect(entry.level).toBe('error');
    expect(entry.message).toBe('something broke');
  });

  it('redacts sensitive keys containing "password"', () => {
    logger.info('auth', { userPassword: 'secret123' });
    const raw = stdoutSpy.mock.calls[0][0] as string;
    const entry = JSON.parse(raw);
    expect(entry.userPassword).toBe('[REDACTED]');
  });

  it('redacts sensitive keys containing "token"', () => {
    logger.info('auth', { accessToken: 'abc' });
    const raw = stdoutSpy.mock.calls[0][0] as string;
    const entry = JSON.parse(raw);
    expect(entry.accessToken).toBe('[REDACTED]');
  });

  it('redacts sensitive keys containing "cost"', () => {
    logger.info('product', { supplierCost: 9.99 });
    const raw = stdoutSpy.mock.calls[0][0] as string;
    const entry = JSON.parse(raw);
    expect(entry.supplierCost).toBe('[REDACTED]');
  });

  it('does not redact non-sensitive keys', () => {
    logger.info('product', { name: 'dress', price: 49.99 });
    const raw = stdoutSpy.mock.calls[0][0] as string;
    const entry = JSON.parse(raw);
    expect(entry.name).toBe('dress');
    expect(entry.price).toBe(49.99);
  });
});
