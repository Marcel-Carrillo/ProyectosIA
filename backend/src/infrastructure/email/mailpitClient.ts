const DEFAULT_MAILPIT_API = 'http://localhost:8025/api/v1';

function getMailpitApiBase(): string {
  return process.env.MAILPIT_API_URL ?? DEFAULT_MAILPIT_API;
}

export async function isMailpitAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${getMailpitApiBase()}/messages`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function clearMailpitMessages(): Promise<void> {
  await fetch(`${getMailpitApiBase()}/messages`, { method: 'DELETE' });
}

export async function waitForPasswordResetEmail(
  to: string,
  timeoutMs = 8000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${getMailpitApiBase()}/messages`);
    if (!res.ok) {
      throw new Error(`Mailpit API error: ${res.status}`);
    }
    const body = (await res.json()) as {
      messages?: Array<{ ID: string; To?: Array<{ Address?: string }> }>;
    };
    const match = body.messages?.find((msg) =>
      msg.To?.some((recipient) => recipient.Address?.toLowerCase() === to.toLowerCase()),
    );
    if (match) {
      const detailRes = await fetch(`${getMailpitApiBase()}/message/${match.ID}`);
      if (!detailRes.ok) {
        throw new Error(`Mailpit message fetch failed: ${detailRes.status}`);
      }
      const detail = (await detailRes.json()) as { Text?: string; HTML?: string };
      const content = detail.Text ?? detail.HTML ?? '';
      const tokenMatch = content.match(/token=([a-f0-9]{64})/i);
      if (tokenMatch?.[1]) {
        return tokenMatch[1];
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Password reset email not received for ${to}`);
}
