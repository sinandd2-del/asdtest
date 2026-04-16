import { Resend } from 'resend';
import { env } from '../shared/env.js';
import { writeAuditLog } from '../security/audit.js';

type SendInput = {
  to: string;
  subject: string;
  html: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  dedupeKey?: string;
};

type SendResult = { ok: true; providerMessageId?: string } | { ok: false; error: string };

interface EmailProvider {
  send(input: SendInput): Promise<SendResult>;
}

class NoopEmailProvider implements EmailProvider {
  async send(_input: SendInput): Promise<SendResult> {
    return { ok: true, providerMessageId: 'noop' };
  }
}

class ResendEmailProvider implements EmailProvider {
  private client: Resend;

  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }

  async send(input: SendInput): Promise<SendResult> {
    try {
      const response = await this.client.emails.send({
        from: env.EMAIL_FROM ?? 'security@poker.local',
        to: input.to,
        subject: input.subject,
        html: input.html,
        tags: input.dedupeKey ? [{ name: 'dedupe_key', value: input.dedupeKey }] : undefined
      });
      if (response.error) {
        return { ok: false, error: response.error.message };
      }
      return { ok: true, providerMessageId: response.data?.id };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'send_failed' };
    }
  }
}

function buildProvider(): EmailProvider {
  if (env.EMAIL_PROVIDER === 'resend' && env.RESEND_API_KEY) {
    return new ResendEmailProvider(env.RESEND_API_KEY);
  }
  return new NoopEmailProvider();
}

const provider = buildProvider();

export async function sendEmailWithRetry(input: SendInput): Promise<SendResult> {
  const maxAttempts = 2;
  let lastResult: SendResult = { ok: false, error: 'unknown' };

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await provider.send(input);
    lastResult = result;
    if (result.ok) {
      await writeAuditLog({
        userId: input.userId,
        actor: input.userId ? 'user' : 'system',
        action: 'email.delivery.sent',
        ipAddress: '127.0.0.1',
        metadata: { ...input.metadata, to: input.to, subject: input.subject, providerMessageId: result.providerMessageId, attempt }
      });
      return result;
    }
  }

  await writeAuditLog({
    userId: input.userId,
    actor: input.userId ? 'user' : 'system',
    action: 'email.delivery.failed',
    ipAddress: '127.0.0.1',
    metadata: { ...input.metadata, to: input.to, subject: input.subject, error: lastResult.ok ? null : lastResult.error }
  });

  return lastResult;
}

export function emailLinks(token: string) {
  return {
    verify: `${env.WEB_BASE_URL}/account/verify-email?token=${encodeURIComponent(token)}`,
    reset: `${env.WEB_BASE_URL}/account/reset-password?token=${encodeURIComponent(token)}`
  };
}
