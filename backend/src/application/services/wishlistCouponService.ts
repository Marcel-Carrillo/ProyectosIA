import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../infrastructure/prismaClient';
import { VariantNotFoundError } from '../../infrastructure/repositories/productVariantRepository';

const variantSelect = {
  id: true,
  sku: true,
  size: true,
  color: true,
  publicPrice: true,
  status: true,
  product: { select: { id: true, name: true, mainImageUrl: true, slug: true } },
} as const;

export class WishlistService {
  async list(customerAccountId: number) {
    const items = await prisma.wishlistItem.findMany({
      where: { customerAccountId },
      include: { productVariant: { select: variantSelect } },
      orderBy: { createdAt: 'desc' },
    });
    return items.map((item) => ({
      id: item.id,
      productVariantId: item.productVariantId,
      createdAt: item.createdAt,
      variant: {
        id: item.productVariant.id,
        sku: item.productVariant.sku,
        size: item.productVariant.size,
        color: item.productVariant.color,
        publicPrice: item.productVariant.publicPrice.toString(),
        product: item.productVariant.product,
      },
    }));
  }

  async add(customerAccountId: number, productVariantId: number) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: productVariantId },
      select: variantSelect,
    });
    if (!variant || variant.status !== 'Active') throw new VariantNotFoundError();

    const existing = await prisma.wishlistItem.findUnique({
      where: { customerAccountId_productVariantId: { customerAccountId, productVariantId } },
      include: { productVariant: { select: variantSelect } },
    });
    if (existing) {
      return {
        id: existing.id,
        productVariantId: existing.productVariantId,
        createdAt: existing.createdAt,
        variant: {
          id: existing.productVariant.id,
          sku: existing.productVariant.sku,
          size: existing.productVariant.size,
          color: existing.productVariant.color,
          publicPrice: existing.productVariant.publicPrice.toString(),
          product: existing.productVariant.product,
        },
      };
    }

    const created = await prisma.wishlistItem.create({
      data: { customerAccountId, productVariantId },
      include: { productVariant: { select: variantSelect } },
    });
    return {
      id: created.id,
      productVariantId: created.productVariantId,
      createdAt: created.createdAt,
      variant: {
        id: created.productVariant.id,
        sku: created.productVariant.sku,
        size: created.productVariant.size,
        color: created.productVariant.color,
        publicPrice: created.productVariant.publicPrice.toString(),
        product: created.productVariant.product,
      },
    };
  }

  async remove(customerAccountId: number, productVariantId: number) {
    await prisma.wishlistItem.deleteMany({
      where: { customerAccountId, productVariantId },
    });
  }
}

export const wishlistService = new WishlistService();

export class CouponExhaustedError extends Error {
  readonly code = 'COUPON_EXHAUSTED';
  readonly status = 409;
  constructor() {
    super('Coupon has reached maximum uses');
    this.name = 'CouponExhaustedError';
  }
}

export class CouponNotFoundError extends Error {
  readonly code = 'COUPON_NOT_FOUND';
  readonly status = 404;
  constructor() {
    super('Coupon not found');
    this.name = 'CouponNotFoundError';
  }
}

export class CouponService {
  async validate(code: string, subtotalAmount: string) {
    const coupon = await prisma.coupon.findUnique({
      where: { code: code.trim().toUpperCase() },
    });
    if (!coupon) throw new CouponNotFoundError();

    const subtotal = new Decimal(subtotalAmount);
    const now = new Date();

    if (!coupon.active) return { valid: false as const, reason: 'inactive' };
    if (coupon.startsAt && coupon.startsAt > now) return { valid: false as const, reason: 'not_started' };
    if (coupon.expiresAt && coupon.expiresAt < now) return { valid: false as const, reason: 'expired' };
    if (subtotal.lessThan(coupon.minOrderAmount)) return { valid: false as const, reason: 'min_order_not_met' };
    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      return { valid: false as const, reason: 'exhausted' };
    }

    let discountAmount: Decimal;
    if (coupon.type === 'percentage') {
      discountAmount = subtotal.mul(coupon.value).div(100);
    } else {
      discountAmount = Decimal.min(new Decimal(coupon.value.toString()), subtotal);
    }

    return {
      valid: true as const,
      discountAmount: discountAmount.toFixed(2),
      type: coupon.type,
      value: coupon.value.toString(),
      couponId: coupon.id,
    };
  }

  async applyInTransaction(
    tx: Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
    couponCode: string,
    subtotal: Decimal,
    customerOrderId: number
  ): Promise<Decimal> {
    const coupon = await tx.coupon.findUnique({
      where: { code: couponCode.trim().toUpperCase() },
    });
    if (!coupon) throw new CouponNotFoundError();

    const validation = await this.validate(couponCode, subtotal.toFixed(2));
    if (!validation.valid) {
      if (validation.reason === 'exhausted') throw new CouponExhaustedError();
      throw new CouponNotFoundError();
    }

    if (coupon.maxUses !== null) {
      const updated = await tx.$executeRaw`
        UPDATE "Coupon"
        SET "usedCount" = "usedCount" + 1
        WHERE id = ${coupon.id} AND ("maxUses" IS NULL OR "usedCount" < "maxUses")
      `;
      if (Number(updated) === 0) throw new CouponExhaustedError();
    } else {
      await tx.coupon.update({
        where: { id: coupon.id },
        data: { usedCount: { increment: 1 } },
      });
    }

    const discount = new Decimal(validation.discountAmount);
    await tx.couponRedemption.create({
      data: {
        couponId: coupon.id,
        customerOrderId,
        discountAmount: discount,
      },
    });
    return discount;
  }
}

export const couponService = new CouponService();
