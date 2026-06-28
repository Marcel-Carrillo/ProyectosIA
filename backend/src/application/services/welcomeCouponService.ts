import { prisma } from '../../infrastructure/prismaClient';
import {
  WELCOME_COUPON_CODE,
  WELCOME_COUPON_DISPLAY,
  getWelcomeCouponMinOrder,
  getWelcomeCouponPercent,
} from '../../constants/welcomeCoupon';

export interface WelcomeCouponDetails {
  code: string;
  percent: number;
  expiresAt: Date | null;
}

/** Ensures the shared welcome coupon exists; returns display metadata for emails. */
export async function ensureWelcomeCouponExists(): Promise<WelcomeCouponDetails> {
  const percent = getWelcomeCouponPercent();
  const minOrderAmount = getWelcomeCouponMinOrder();

  const coupon = await prisma.coupon.upsert({
    where: { code: WELCOME_COUPON_CODE },
    update: {
      active: true,
      type: 'percentage',
      value: percent,
      minOrderAmount,
      maxUses: null,
    },
    create: {
      code: WELCOME_COUPON_CODE,
      type: 'percentage',
      value: percent,
      minOrderAmount,
      maxUses: null,
      active: true,
      startsAt: new Date(),
      expiresAt: null,
    },
  });

  return {
    code: WELCOME_COUPON_DISPLAY,
    percent,
    expiresAt: coupon.expiresAt,
  };
}
