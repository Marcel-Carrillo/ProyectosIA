import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../application/validator';
import {
  ProductNotFoundError,
  ProductSlugConflictError,
  ProductRequiresActiveVariantError,
  ProductArchivedCannotReactivateError,
} from '../infrastructure/repositories/productRepository';
import {
  VariantNotFoundError,
  VariantSkuConflictError,
  VariantComparePriceInvalidError,
} from '../infrastructure/repositories/productVariantRepository';
import { ImageNotFoundError } from '../infrastructure/repositories/productImageRepository';
import { SupplierNotFoundError } from '../infrastructure/repositories/supplierRepository';
import {
  CustomerNotFoundError,
  CustomerEmailConflictError,
  CustomerHasOrdersError,
  AddressNotFoundError,
} from '../infrastructure/repositories/customerRepository';
import {
  CustomerOrderNotFoundError,
  OrderNumberConflictError,
  OrderStatusTransitionInvalidError,
  PaymentStatusTransitionInvalidError,
  FulfillmentStatusTransitionInvalidError,
} from '../infrastructure/repositories/customerOrderRepository';

interface AppError {
  message: string;
  code?: string;
  status?: number;
}

export function notFoundHandler(
  _req: Request,
  _res: Response,
  next: NextFunction
): void {
  const error: AppError = {
    message: 'Route not found',
    code: 'NOT_FOUND',
    status: 404,
  };
  next(error);
}

export function globalErrorHandler(
  err: AppError | Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Internal server error';

  if (err instanceof ValidationError) {
    statusCode = 400;
    code = err.code;
    message = err.message;
  } else if (err instanceof ProductNotFoundError) {
    statusCode = 404; code = err.code; message = err.message;
  } else if (err instanceof VariantNotFoundError) {
    statusCode = 404; code = err.code; message = err.message;
  } else if (err instanceof ImageNotFoundError) {
    statusCode = 404; code = err.code; message = err.message;
  } else if (err instanceof SupplierNotFoundError) {
    statusCode = 404; code = err.code; message = err.message;
  } else if (err instanceof CustomerNotFoundError) {
    statusCode = 404; code = err.code; message = err.message;
  } else if (err instanceof AddressNotFoundError) {
    statusCode = 404; code = err.code; message = err.message;
  } else if (err instanceof CustomerEmailConflictError) {
    statusCode = 409; code = err.code; message = err.message;
  } else if (err instanceof CustomerHasOrdersError) {
    statusCode = 409; code = err.code; message = err.message;
  } else if (err instanceof CustomerOrderNotFoundError) {
    statusCode = 404; code = err.code; message = err.message;
  } else if (err instanceof OrderNumberConflictError) {
    statusCode = 409; code = err.code; message = err.message;
  } else if (err instanceof OrderStatusTransitionInvalidError) {
    statusCode = 422; code = err.code; message = err.message;
  } else if (err instanceof PaymentStatusTransitionInvalidError) {
    statusCode = 422; code = err.code; message = err.message;
  } else if (err instanceof FulfillmentStatusTransitionInvalidError) {
    statusCode = 422; code = err.code; message = err.message;
  } else if (err instanceof ProductSlugConflictError) {
    statusCode = 409; code = err.code; message = err.message;
  } else if (err instanceof VariantSkuConflictError) {
    statusCode = 409; code = err.code; message = err.message;
  } else if (err instanceof ProductRequiresActiveVariantError) {
    statusCode = 422; code = err.code; message = err.message;
  } else if (err instanceof ProductArchivedCannotReactivateError) {
    statusCode = 422; code = err.code; message = err.message;
  } else if (err instanceof VariantComparePriceInvalidError) {
    statusCode = 422; code = err.code; message = err.message;
  } else if ('status' in err && typeof err.status === 'number') {
    statusCode = err.status;
    code = (err as AppError).code ?? 'ERROR';
    message = err.message;
  } else if (err instanceof Error && err.message) {
    message = err.message;
  }

  res.status(statusCode).json({
    success: false,
    error: { message, code },
  });
}
