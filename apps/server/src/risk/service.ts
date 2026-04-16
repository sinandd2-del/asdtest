import { prisma } from '../shared/prisma.js';

export async function evaluateWithdrawalRisk(input: {
  userId: string;
  ipAddress: string;
  amount: number;
  network: string;
}) {
  let score = 0;
  const flags: string[] = [];

  if (input.amount > 2000) {
    score += 30;
    flags.push('amount_threshold');
  }

  const hourAgo = new Date(Date.now() - 60 * 60_000);
  const recentCount = await prisma.withdrawal.count({
    where: {
      userId: input.userId,
      createdAt: { gt: hourAgo }
    }
  });

  if (recentCount >= 3) {
    score += 40;
    flags.push('rapid_withdrawals');
  }

  if (score > 0) {
    await prisma.riskFlag.create({
      data: {
        userId: input.userId,
        type: 'withdrawal',
        severity: score >= 60 ? 'high' : 'medium',
        context: { flags, ipAddress: input.ipAddress, network: input.network, amount: input.amount }
      }
    });
  }

  return { score, flags };
}
