import { Request, Response, NextFunction } from 'express';
import { globalErrorHandler, notFoundHandler } from './errorHandler';
import { ValidationError } from '../application/validator';

function makeRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

describe('notFoundHandler', () => {
  it('calls next with a 404 NOT_FOUND error', () => {
    const next = jest.fn() as NextFunction;
    notFoundHandler({} as Request, {} as Response, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Route not found', code: 'NOT_FOUND', status: 404 })
    );
  });
});

describe('globalErrorHandler', () => {
  it('returns 400 for ValidationError', () => {
    const res = makeRes();
    const err = new ValidationError('Field x is required');
    globalErrorHandler(err, {} as Request, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 500 for generic Error', () => {
    const res = makeRes();
    globalErrorHandler(new Error('Boom'), {} as Request, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('uses status property when present', () => {
    const res = makeRes();
    const err = { message: 'Not found', code: 'NOT_FOUND', status: 404 };
    globalErrorHandler(err as unknown as Error, {} as Request, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('response body follows { success: false, error: { message, code } } format', () => {
    const res = makeRes();
    globalErrorHandler(new Error('Oops'), {} as Request, res, jest.fn());
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ message: expect.any(String), code: expect.any(String) }),
      })
    );
  });

  it('response body does not contain a stack trace', () => {
    const res = makeRes();
    globalErrorHandler(new Error('Oops'), {} as Request, res, jest.fn());
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(JSON.stringify(body)).not.toContain('at ');
  });
});
