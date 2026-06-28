/** Canonical DB code (validation is case-insensitive). */
export const WELCOME_COUPON_CODE = 'BIENVENIDA15';

/** Display form shown in emails and UI. */
export const WELCOME_COUPON_DISPLAY = 'Bienvenida15';

export function isWelcomeCouponCode(code: string): boolean {
  return code.trim().toUpperCase() === WELCOME_COUPON_CODE;
}

export function getWelcomeCouponPercent(): number {
  return parseInt(process.env.WELCOME_COUPON_PERCENT ?? '15', 10);
}

export function getWelcomeCouponMinOrder(): number {
  return parseFloat(process.env.WELCOME_COUPON_MIN_ORDER ?? '0');
}
