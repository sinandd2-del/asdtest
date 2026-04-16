import { prisma } from '../shared/prisma.js';

export async function writeAuditLog(input: {
  userId?: string;
  actor: string;
  action: string;
  ipAddress: string;
  metadata: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      userId: input.userId,
      actor: input.actor,
      action: input.action,
      ipAddress: input.ipAddress,
      metadata: input.metadata
    }
  });
}
