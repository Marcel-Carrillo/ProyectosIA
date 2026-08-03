import { Request, Response, NextFunction } from 'express';
import { logger } from '../infrastructure/logger';
import {
  ValidationError,
  TranslationLocaleInvalidError,
  OrderNotPayableError,
  OrderNotCancellableError,
} from '../application/validator';
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
import { TranslationNotFoundError } from '../infrastructure/repositories/productTranslationRepository';
import { SupplierNotFoundError } from '../infrastructure/repositories/supplierRepository';
import { SupplierIntegrationNotFoundError } from '../infrastructure/repositories/supplierIntegrationRepository';
import {
  CjConnectionNotReadyError,
  CjApiUnavailableError,
  CjItemNotMappedError,
  CjOrderAlreadyPushedError,
  CjOrderNotPushedError,
  CjCatalogItemNotPromotedError,
  CjPromotionPriceRequiredError,
  CjPromotionCategoryRequiredError,
  CjCatalogItemSyncFailedCannotPromoteError,
  CjCatalogItemNotFoundError,
  CjPromotionValidationError,
  CjCarrierAllowListExhaustedError,
  CjSandboxOnlyError,
} from '../application/validator';
import {
  CustomerNotFoundError,
  CustomerEmailConflictError,
  CustomerHasOrdersError,
  AddressNotFoundError,
} from '../infrastructure/repositories/customerRepository';
import { AddressDefaultConflictError } from '../infrastructure/repositories/customerAddressDefaultTransaction';
import {
  CustomerOrderNotFoundError,
  OrderNumberConflictError,
  OrderStatusTransitionInvalidError,
  PaymentStatusTransitionInvalidError,
  FulfillmentStatusTransitionInvalidError,
} from '../infrastructure/repositories/customerOrderRepository';
import {
  SupplierOrderNotFoundError,
  SupplierOrderNumberConflictError,
  CustomerOrderNotEligibleError,
  VariantSupplierMissingError,
  SupplierBlockedError,
  SupplierOrderStatusTransitionInvalidError,
} from '../infrastructure/repositories/supplierOrderRepository';
import {
  RefundNotFoundError,
  RefundOrderNotPaidError,
  RefundAmountExceedsBalanceError,
  RefundTransitionInvalidError,
} from '../infrastructure/repositories/refundRepository';
import {
  ShipmentNotFoundError,
  ShipmentStatusTransitionInvalidError,
} from '../infrastructure/repositories/shipmentRepository';
import {
  ReturnRequestNotFoundError,
  ReturnRequestOrderCancelledError,
  ReturnRequestItemMismatchError,
  ReturnRequestTransitionInvalidError,
} from '../infrastructure/repositories/returnRequestRepository';
import {
  ReviewNotFoundError,
  ReviewAlreadyExistsError,
  ReviewPurchaseNotVerifiedError,
  ReviewTransitionInvalidError,
} from '../infrastructure/repositories/reviewRepository';
import { CustomerOrderItemNotFoundError } from '../infrastructure/repositories/customerOrderRepository';
import {
  AdminDisabledError,
  AdminOtpEmailFailedError,
  AdminRefreshTokenInvalidError,
  InvalidAdminCredentialsError,
  InvalidAdminOtpError,
} from '../infrastructure/repositories/adminUserRepository';
import {
  AccountEmailConflictError,
  InvalidCustomerCredentialsError,
  AccountDisabledError,
  CustomerRefreshTokenInvalidError,
  ResetTokenInvalidError,
  InvalidTotpCodeError,
} from '../application/services/customerAuthService';
import {
  CouponExhaustedError,
  CouponNotFoundError,
} from '../application/services/wishlistCouponService';

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

  // CjPromotionValidationError carries a per-item error list beyond
  // message/code — the only error in this handler that needs an extra
  // response field, so it returns early instead of falling into the shared
  // `res.status(...).json(...)` at the bottom.
  if (err instanceof CjPromotionValidationError) {
    res.status(err.status).json({
      success: false,
      error: { message: err.message, code: err.code, itemErrors: err.itemErrors },
    });
    return;
  }

  if (err instanceof ValidationError) {
    statusCode = 400;
    code = err.code;
    message = err.message;
  } else if (err instanceof TranslationLocaleInvalidError) {
    statusCode = err.status;
    code = err.code;
    message = err.message;
  } else if (err instanceof TranslationNotFoundError) {
    statusCode = err.status;
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
  } else if (err instanceof SupplierIntegrationNotFoundError) {
    statusCode = 404; code = err.code; message = err.message;
  } else if (err instanceof CjConnectionNotReadyError) {
    statusCode = 422; code = err.code; message = err.message;
  } else if (err instanceof CjApiUnavailableError) {
    statusCode = 502; code = err.code; message = err.message;
  } else if (err instanceof CjItemNotMappedError) {
    statusCode = 422; code = err.code; message = err.message;
  } else if (err instanceof CjOrderAlreadyPushedError) {
    statusCode = 409; code = err.code; message = err.message;
  } else if (err instanceof CjOrderNotPushedError) {
    statusCode = 422; code = err.code; message = err.message;
  } else if (err instanceof CjCarrierAllowListExhaustedError) {
    statusCode = 422; code = err.code; message = err.message;
  } else if (err instanceof CjSandboxOnlyError) {
    statusCode = 422; code = err.code; message = err.message;
  } else if (err instanceof CjCatalogItemNotPromotedError) {
    statusCode = 422; code = err.code; message = err.message;
  } else if (err instanceof CjPromotionPriceRequiredError) {
    statusCode = 422; code = err.code; message = err.message;
  } else if (err instanceof CjPromotionCategoryRequiredError) {
    statusCode = 422; code = err.code; message = err.message;
  } else if (err instanceof CjCatalogItemSyncFailedCannotPromoteError) {
    statusCode = 422; code = err.code; message = err.message;
  } else if (err instanceof CjCatalogItemNotFoundError) {
    statusCode = 422; code = err.code; message = err.message;
  } else if (err instanceof CustomerNotFoundError) {
    statusCode = 404; code = err.code; message = err.message;
  } else if (err instanceof AddressNotFoundError) {
    statusCode = 404; code = err.code; message = err.message;
  } else if (err instanceof AddressDefaultConflictError) {
    statusCode = 409; code = err.code; message = err.message;
  } else if (err instanceof CustomerEmailConflictError) {
    statusCode = 409; code = err.code; message = err.message;
  } else if (err instanceof CustomerHasOrdersError) {
    statusCode = 409; code = err.code; message = err.message;
  } else if (err instanceof CustomerOrderNotFoundError) {
    statusCode = 404; code = err.code; message = err.message;
  } else if (err instanceof OrderNumberConflictError) {
    statusCode = 409; code = err.code; message = err.message;
  } else if (err instanceof OrderNotPayableError) {
    statusCode = 409; code = err.code; message = err.message;
  } else if (err instanceof OrderNotCancellableError) {
    statusCode = 409; code = err.code; message = err.message;
  } else if (err instanceof OrderStatusTransitionInvalidError) {
    statusCode = 422; code = err.code; message = err.message;
  } else if (err instanceof PaymentStatusTransitionInvalidError) {
    statusCode = 422; code = err.code; message = err.message;
  } else if (err instanceof FulfillmentStatusTransitionInvalidError) {
    statusCode = 422; code = err.code; message = err.message;
  } else if (err instanceof SupplierOrderNotFoundError) {
    statusCode = 404; code = err.code; message = err.message;
  } else if (err instanceof SupplierOrderNumberConflictError) {
    statusCode = 409; code = err.code; message = err.message;
  } else if (err instanceof CustomerOrderNotEligibleError) {
    statusCode = 422; code = err.code; message = err.message;
  } else if (err instanceof VariantSupplierMissingError) {
    statusCode = 422; code = err.code; message = err.message;
  } else if (err instanceof SupplierBlockedError) {
    statusCode = 422; code = err.code; message = err.message;
  } else if (err instanceof SupplierOrderStatusTransitionInvalidError) {
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
  } else if (err instanceof RefundNotFoundError) {
    statusCode = 404; code = err.code; message = err.message;
  } else if (err instanceof RefundOrderNotPaidError) {
    statusCode = 409; code = err.code; message = err.message;
  } else if (err instanceof RefundAmountExceedsBalanceError) {
    statusCode = 409; code = err.code; message = err.message;
  } else if (err instanceof RefundTransitionInvalidError) {
    statusCode = 422; code = err.code; message = err.message;
  } else if (err instanceof ReviewNotFoundError) {
    statusCode = 404; code = err.code; message = err.message;
  } else if (err instanceof ReviewAlreadyExistsError) {
    statusCode = 409; code = err.code; message = err.message;
  } else if (err instanceof ReviewPurchaseNotVerifiedError) {
    statusCode = 403; code = err.code; message = err.message;
  } else if (err instanceof ReviewTransitionInvalidError) {
    statusCode = 409; code = err.code; message = err.message;
  } else if (err instanceof ShipmentNotFoundError) {
    statusCode = 404; code = err.code; message = err.message;
  } else if (err instanceof ShipmentStatusTransitionInvalidError) {
    statusCode = 400; code = err.code; message = err.message;
  } else if (err instanceof ReturnRequestNotFoundError) {
    statusCode = 404; code = err.code; message = err.message;
  } else if (err instanceof ReturnRequestOrderCancelledError) {
    statusCode = 409; code = err.code; message = err.message;
  } else if (err instanceof ReturnRequestItemMismatchError) {
    statusCode = 422; code = err.code; message = err.message;
  } else if (err instanceof ReturnRequestTransitionInvalidError) {
    statusCode = 409; code = err.code; message = err.message;
  } else if (err instanceof CustomerOrderItemNotFoundError) {
    statusCode = 404; code = err.code; message = err.message;
  } else if (err instanceof InvalidAdminCredentialsError) {
    statusCode = 401; code = err.code; message = err.message;
  } else if (err instanceof InvalidAdminOtpError) {
    statusCode = 401; code = err.code; message = err.message;
  } else if (err instanceof AdminOtpEmailFailedError) {
    statusCode = 503; code = err.code; message = err.message;
  } else if (err instanceof AdminDisabledError) {
    statusCode = 403; code = err.code; message = err.message;
  } else if (err instanceof AdminRefreshTokenInvalidError) {
    statusCode = 401; code = err.code; message = err.message;
  } else if (err instanceof AccountEmailConflictError) {
    statusCode = 409; code = err.code; message = err.message;
  } else if (err instanceof InvalidCustomerCredentialsError) {
    statusCode = 401; code = err.code; message = err.message;
  } else if (err instanceof AccountDisabledError) {
    statusCode = 403; code = err.code; message = err.message;
  } else if (err instanceof CustomerRefreshTokenInvalidError) {
    statusCode = 401; code = err.code; message = err.message;
  } else if (err instanceof ResetTokenInvalidError) {
    statusCode = 400; code = err.code; message = err.message;
  } else if (err instanceof InvalidTotpCodeError) {
    statusCode = 401; code = err.code; message = err.message;
  } else if (err instanceof CouponExhaustedError) {
    statusCode = 409; code = err.code; message = err.message;
  } else if (err instanceof CouponNotFoundError) {
    statusCode = 404; code = err.code; message = err.message;
  } else if ('status' in err && typeof err.status === 'number') {
    statusCode = err.status;
    code = (err as AppError).code ?? 'ERROR';
    message = err.message;
  } else {
    // Unexpected error (no domain status): keep the generic 500 payload so
    // internals (Prisma/driver messages, stack hints) never leak to clients,
    // and log the real error for diagnosis.
    logger.error('Unhandled error reached globalErrorHandler', {
      name: err instanceof Error ? err.name : typeof err,
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
  }

  res.status(statusCode).json({
    success: false,
    error: { message, code },
  });
}
