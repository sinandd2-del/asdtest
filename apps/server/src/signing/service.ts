import { env } from '../shared/env.js';

export async function requestSigning(input: {
  network: string;
  withdrawalId: string;
  unsignedPayload: Record<string, unknown>;
}) {
  const response = await fetch(`${env.SIGNER_BASE_URL}/sign`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error(`Signer request failed: ${response.status}`);
  }

  return (await response.json()) as { signedPayload: Record<string, unknown>; signerRef: string };
}
