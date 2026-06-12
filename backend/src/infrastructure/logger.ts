const SENSITIVE_KEYS = ['password', 'token', 'secret', 'cost', 'credential'];

function sanitize(meta?: Record<string, unknown>): Record<string, unknown> {
  if (!meta) return {};
  return Object.fromEntries(
    Object.entries(meta).map(([key, value]) => {
      const isSensitive = SENSITIVE_KEYS.some((k) =>
        key.toLowerCase().includes(k)
      );
      return [key, isSensitive ? '[REDACTED]' : value];
    })
  );
}

function buildEntry(
  level: string,
  message: string,
  meta?: Record<string, unknown>
): string {
  return JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    ...sanitize(meta),
  });
}

export const logger = {
  info(message: string, meta?: Record<string, unknown>): void {
    process.stdout.write(buildEntry('info', message, meta) + '\n');
  },
  warn(message: string, meta?: Record<string, unknown>): void {
    process.stdout.write(buildEntry('warn', message, meta) + '\n');
  },
  error(message: string, meta?: Record<string, unknown>): void {
    process.stderr.write(buildEntry('error', message, meta) + '\n');
  },
};
