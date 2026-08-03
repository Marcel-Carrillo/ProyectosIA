/** Captures the last admin OTP in Jest so integration helpers can complete MFA without Mailpit. */
let lastCode: string | null = null;

export function recordAdminOtpForTests(code: string): void {
  if (process.env.NODE_ENV === 'test') {
    lastCode = code;
  }
}

export function getLastAdminOtpForTests(): string | null {
  return lastCode;
}

export function clearLastAdminOtpForTests(): void {
  lastCode = null;
}
